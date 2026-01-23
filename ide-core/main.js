/**
 * Restricted IDE - Main Process Entry Point
 * 
 * This is the main entry point for the Electron application.
 * It initializes all system services, sets up the policy engine,
 * and creates the main application window.
 * 
 * @module ide-core/main
 */

'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Logger } = require('./utils/Logger');
const { PolicyEngine } = require('./policy/PolicyEngine');
const { IpcMain } = require('./ipc/IpcMain');
const { RuntimeManager } = require('./runtime/RuntimeManager');
const { SystemServiceManager } = require('./runtime/SystemServiceManager');
const config = require('./config');

// Initialize logger
const logger = new Logger('Main');

// Global references to prevent garbage collection
let mainWindow = null;
let policyEngine = null;
let runtimeManager = null;
let systemServiceManager = null;
let ipcHandler = null;

/**
 * Creates the main application window with security restrictions
 * @returns {BrowserWindow} The main browser window
 */
function createMainWindow() {
  logger.info('Creating main window...');

  const windowOptions = {
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    
    // Security: Start in fullscreen for kiosk mode
    fullscreen: config.kioskMode.enabled,
    fullscreenable: true,
    
    // Security: Disable window controls in kiosk mode
    frame: !config.kioskMode.enabled,
    closable: !config.kioskMode.enabled || config.kioskMode.adminCanClose,
    minimizable: !config.kioskMode.enabled,
    maximizable: !config.kioskMode.enabled,
    resizable: !config.kioskMode.enabled,
    
    // Security: Keep window always on top in kiosk mode
    alwaysOnTop: config.kioskMode.enabled,
    
    // Security: Disable keyboard shortcuts
    skipTaskbar: config.kioskMode.enabled,

    webPreferences: {
      // Security: Enable context isolation
      contextIsolation: true,
      
      // Security: Disable Node.js in renderer
      nodeIntegration: false,
      
      // Security: Enable sandbox
      sandbox: true,
      
      // Preload script for secure IPC
      preload: path.join(__dirname, '..', 'ide-ui', 'preload.js'),
      
      // Security: Disable remote module
      enableRemoteModule: false,
      
      // Security: Disable webview tag (we'll use iframe with restrictions)
      webviewTag: false,
      
      // Security: Disable dev tools in production
      devTools: config.isDevelopment,
      
      // Security: Disable navigation to file:// URLs
      allowRunningInsecureContent: false,
    },
    
    // Icon
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  };

  mainWindow = new BrowserWindow(windowOptions);

  // Load the main UI
  const uiPath = path.join(__dirname, '..', 'ide-ui', 'index.html');
  mainWindow.loadFile(uiPath);

  // Security: Prevent new windows
  mainWindow.webContents.setWindowOpenHandler(() => {
    logger.warn('Blocked attempt to open new window');
    return { action: 'deny' };
  });

  // Security: Intercept navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowed = policyEngine.validateUrl(url);
    if (!isAllowed) {
      logger.warn(`Blocked navigation to: ${url}`);
      event.preventDefault();
    }
  });

  // Security: Log window events
  mainWindow.on('close', (event) => {
    if (config.kioskMode.enabled && !runtimeManager.isAdminExitRequested()) {
      logger.warn('Blocked window close attempt');
      event.preventDefault();
    } else {
      logger.info('Window closing...');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Window closed');
  });

  // Prevent Alt+F4 in kiosk mode
  mainWindow.on('session-end', (event) => {
    if (config.kioskMode.enabled) {
      event.preventDefault();
    }
  });

  // Open DevTools in development mode
  if (config.isDevelopment && config.openDevToolsOnStart) {
    mainWindow.webContents.openDevTools();
  }

  logger.info('Main window created successfully');
  return mainWindow;
}

/**
 * Initialize system services (native modules)
 */
async function initializeSystemServices() {
  logger.info('Initializing system services...');
  
  try {
    systemServiceManager = new SystemServiceManager(policyEngine);
    await systemServiceManager.initialize();
    
    logger.info('System services initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize system services: ${error.message}`);
    
    if (!config.isDevelopment) {
      // In production, system services are required
      throw error;
    } else {
      logger.warn('Running without system services in development mode');
    }
  }
}

/**
 * Initialize the policy engine
 */
async function initializePolicyEngine() {
  logger.info('Initializing policy engine...');
  
  policyEngine = new PolicyEngine();
  await policyEngine.initialize();
  
  logger.info('Policy engine initialized');
}

/**
 * Initialize IPC handlers
 */
function initializeIpc() {
  logger.info('Initializing IPC handlers...');
  
  ipcHandler = new IpcMain(policyEngine, runtimeManager, systemServiceManager);
  ipcHandler.registerHandlers();
  
  logger.info('IPC handlers registered');
}

/**
 * Initialize runtime manager
 */
function initializeRuntimeManager() {
  logger.info('Initializing runtime manager...');
  
  runtimeManager = new RuntimeManager(policyEngine);
  runtimeManager.initialize();
  
  logger.info('Runtime manager initialized');
}

/**
 * Application startup sequence
 */
async function startup() {
  logger.info('='.repeat(50));
  logger.info('Restricted IDE Starting...');
  logger.info(`Version: ${config.version}`);
  logger.info(`Environment: ${config.isDevelopment ? 'Development' : 'Production'}`);
  logger.info(`Kiosk Mode: ${config.kioskMode.enabled ? 'Enabled' : 'Disabled'}`);
  logger.info('='.repeat(50));

  try {
    // Step 1: Initialize policy engine
    await initializePolicyEngine();
    
    // Step 2: Initialize runtime manager
    initializeRuntimeManager();
    
    // Step 3: Initialize system services (native modules)
    await initializeSystemServices();
    
    // Step 4: Initialize IPC handlers
    initializeIpc();
    
    // Step 5: Create main window
    createMainWindow();
    
    // Step 6: Start system services
    if (systemServiceManager) {
      await systemServiceManager.start();
    }
    
    logger.info('Startup complete');
    
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    logger.error(error.stack);
    app.quit();
  }
}

/**
 * Application shutdown sequence
 */
async function shutdown() {
  logger.info('Shutting down...');
  
  // Stop system services
  if (systemServiceManager) {
    await systemServiceManager.stop();
  }
  
  // Cleanup runtime
  if (runtimeManager) {
    runtimeManager.cleanup();
  }
  
  logger.info('Shutdown complete');
}

// ============================================
// Electron App Event Handlers
// ============================================

// Ready event - application has finished initializing
app.whenReady().then(startup);

// All windows closed
app.on('window-all-closed', () => {
  // On macOS, apps typically stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// App activated (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Before quit
app.on('before-quit', async (event) => {
  if (config.kioskMode.enabled && !runtimeManager?.isAdminExitRequested()) {
    logger.warn('Blocked quit attempt in kiosk mode');
    event.preventDefault();
    return;
  }
  
  await shutdown();
});

// Security: Prevent additional Electron instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logger.warn('Another instance is already running');
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// Security: Disable hardware acceleration in kiosk mode for stability
if (config.kioskMode.enabled) {
  app.disableHardwareAcceleration();
}

// Security: Certificate error handling
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  logger.error(`Certificate error for ${url}: ${error}`);
  // In production, reject invalid certificates
  callback(!config.isDevelopment);
});

// Security: Handle renderer process crashes
app.on('render-process-gone', (event, webContents, details) => {
  logger.error(`Renderer process gone: ${details.reason}`);
  
  // Restart the window
  if (mainWindow) {
    mainWindow.close();
  }
  createMainWindow();
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

module.exports = {
  getMainWindow: () => mainWindow,
  getPolicyEngine: () => policyEngine,
  getRuntimeManager: () => runtimeManager,
};
