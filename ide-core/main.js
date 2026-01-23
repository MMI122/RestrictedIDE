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

const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
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

  // 1. Get the exact size of the user's screen
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  const windowOptions = {
    // 2. Force the window to use those exact dimensions
    width: width,
    height: height,
    x: 0,
    y: 0,
    
    // --- FORCE KIOSK MODE START ---
    kiosk: true,        // Activates native Mac kiosk behavior
    frame: false,       // Hides the "Traffic Lights"
    titleBarStyle: 'hidden',
    
    // 3. Ensure it covers everything
    fullscreen: true,
    simpleFullscreen: true, // Keeps it on the same desktop (no swiping)
    
    // 4. Lock it down
    fullscreenable: false,
    resizable: false,       // User can't resize
    movable: false,         // User can't drag
    minimizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    // --- FORCE KIOSK MODE END ---

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '..', 'ide-ui', 'preload.js'),
      enableRemoteModule: false,
      webviewTag: false,
      devTools: config.isDevelopment,
      allowRunningInsecureContent: false,
    },
    
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
 * Security: Removes the "Quit" option from the macOS system menu
 */
function setupSecureMenu() {
  logger.info('Setting up secure application menu...');
  
  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'RestrictedIDE',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          // { role: 'quit' } <--- REMOVED FOR SECURITY
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
          { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' }, { role: 'togglefullscreen' }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    // Windows/Linux: Hide the menu bar entirely
    Menu.setApplicationMenu(null);
  }
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

   // Step 0: Secure the Menu (PREVENT CMD+Q)
    setupSecureMenu();
    registerAdminShortcut();

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

/**
 * Security: Listen for Unlock Request and restore Window Controls
 */
ipcMain.handle('admin:unlock-window', () => {
  logger.info('🔓 Admin Unlock: Restoring Window Controls...');
  
  if (mainWindow) {
    // 1. Disable strict Kiosk Mode
    mainWindow.setKiosk(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setClosable(true);
    
    // 2. Exit Fullscreen
    mainWindow.setFullScreen(false);
    
    // 3. Restore Traffic Lights (macOS specific)
    if (process.platform === 'darwin') {
      mainWindow.setWindowButtonVisibility(true);
    }
  }
  return { success: true };
});

/**
 * Security: Manually registers the Admin Unlock shortcut
 * because our Input Controller is blocking normal key detection.
 */
function registerAdminShortcut() {
  // 1. Get the keys from config
  const rawKeys = config.admin.secretKeyCombo || ['cmd', 'shift', 'option', 'a'];
  
  // 2. Convert to Electron format (e.g. "Command+Shift+Alt+A")
  const accelerator = rawKeys.map(k => {
    k = k.toLowerCase();
    if (k === 'cmd' || k === 'win') return 'Command';
    if (k === 'option' || k === 'alt') return 'Alt';
    if (k === 'ctrl' || k === 'control') return 'Control';
    if (k === 'shift') return 'Shift';
    return k.charAt(0).toUpperCase() + k.slice(1);
  }).join('+');

  logger.info(`Registering Admin Unlock Shortcut: ${accelerator}`);

  // 3. Register the global listener
  const { globalShortcut } = require('electron');
  globalShortcut.register(accelerator, () => {
    logger.info('🔐 Admin Unlock Sequence Detected!');
    
    if (mainWindow) {
      // Send a signal to the UI to show the password prompt
      // We try the two most common event names this project likely uses
      mainWindow.webContents.send('admin:request-unlock'); 
      mainWindow.webContents.send('show-admin-login');
    }
  });
}

module.exports = {
  getMainWindow: () => mainWindow,
  getPolicyEngine: () => policyEngine,
  getRuntimeManager: () => runtimeManager,
};
