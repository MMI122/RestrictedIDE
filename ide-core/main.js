/**
 * Restricted IDE - Main Process Entry Point
 * 
 * This is the main entry point for the Electron application.
 * It initializes all system services, sets up the policy engine,
 * and creates the main application window.
 * 
 * Cross-platform support for Windows and macOS.
 * 
 * @module ide-core/main
 */

'use strict';

const { app, BrowserWindow, ipcMain, Menu, screen, globalShortcut, clipboard } = require('electron');
const path = require('path');
const { Logger } = require('./utils/Logger');
const { PolicyEngine } = require('./policy/PolicyEngine');
const { IpcMain } = require('./ipc/IpcMain');
const { RuntimeManager } = require('./runtime/RuntimeManager');
const { SystemServiceManager } = require('./runtime/SystemServiceManager');
const config = require('./config');

// Platform detection
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

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
 * Cross-platform: handles both Windows and macOS
 * @returns {BrowserWindow} The main browser window
 */
function createMainWindow() {
  logger.info('Creating main window...');

  // Get the exact size of the user's screen
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  // Base window options (cross-platform)
  const windowOptions = {
    width: width,
    height: height,
    x: 0,
    y: 0,
    
    // Kiosk mode settings
    fullscreen: config.kioskMode.enabled,
    fullscreenable: true,
    
    // Security: Disable window controls in kiosk mode
    frame: !config.kioskMode.enabled,
    closable: !config.kioskMode.enabled || config.kioskMode.adminCanClose,
    minimizable: !config.kioskMode.enabled,
    maximizable: !config.kioskMode.enabled,
    resizable: !config.kioskMode.enabled,
    movable: !config.kioskMode.enabled,
    
    // Security: Keep window always on top in kiosk mode
    alwaysOnTop: config.kioskMode.enabled,
    skipTaskbar: config.kioskMode.enabled,

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

  // Platform-specific kiosk mode options
  if (config.kioskMode.enabled) {
    if (isMac) {
      // macOS-specific kiosk settings
      windowOptions.kiosk = true;
      windowOptions.titleBarStyle = 'hidden';
      windowOptions.simpleFullscreen = true;
    } else if (isWindows) {
      // Windows-specific kiosk settings
      windowOptions.kiosk = true;
    }
  }

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

  // Prevent Alt+F4 / Cmd+Q in kiosk mode
  mainWindow.on('session-end', (event) => {
    if (config.kioskMode.enabled) {
      event.preventDefault();
    }
  });

  // Security: Clear clipboard on focus to prevent pasting from outside (kiosk mode only)
  if (config.kioskMode.enabled) {
    // Clear clipboard on startup
    clipboard.writeText('');
    logger.info('[Security] Clipboard cleared on startup');

    // Clear clipboard every time the window regains focus
    mainWindow.on('focus', () => {
      clipboard.writeText('');
      logger.debug('[Security] Clipboard cleared on window focus');
    });
  }

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
 * Security: Sets up the application menu
 * macOS: Removes "Quit" option from menu
 * Windows: Hides menu entirely
 */
function setupSecureMenu() {
  logger.info('Setting up secure application menu...');
  
  if (isMac) {
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
    logger.info('[Mac] Menu hardened: Quit option removed');
  } else {
    // Windows/Linux: Hide the menu bar entirely
    Menu.setApplicationMenu(null);
    logger.info('[Win] Menu hidden');
  }
}

/**
 * Application startup sequence
 */
async function startup() {
  logger.info('='.repeat(50));
  logger.info('Restricted IDE Starting...');
  logger.info(`Version: ${config.version}`);
  logger.info(`Platform: ${isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux'}`);
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
    
    // Step 3.5: Re-register admin shortcut (after input-control clears shortcuts)
    registerAdminShortcut();
    
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
 * Cross-platform support for Windows and macOS
 */
ipcMain.handle('admin:unlock-window', () => {
  logger.info('🔓 Admin Unlock: Restoring Window Controls...');
  
  if (mainWindow) {
    // Disable strict Kiosk Mode
    mainWindow.setKiosk(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setClosable(true);
    
    // Exit Fullscreen
    mainWindow.setFullScreen(false);
    
    // Platform-specific: Restore window controls
    if (isMac) {
      mainWindow.setWindowButtonVisibility(true);
    }
  }
  return { success: true };
});

/**
 * Security: Manually registers the Admin Unlock shortcut
 * Cross-platform: Uses different key combos for Windows and macOS
 */
function registerAdminShortcut() {
  // Get platform-specific keys from config
  let rawKeys;
  if (isWindows && config.admin.secretKeyCombo_windows) {
    rawKeys = config.admin.secretKeyCombo_windows;
  } else if (isMac && config.admin.secretKeyCombo_darwin) {
    rawKeys = config.admin.secretKeyCombo_darwin;
  } else {
    rawKeys = config.admin.secretKeyCombo || (isWindows ? ['ctrl', 'shift', 'alt', 'a'] : ['cmd', 'shift', 'option', 'a']);
  }
  
  // Convert to Electron accelerator format
  const accelerator = rawKeys.map(k => {
    k = k.toLowerCase();
    if (k === 'cmd' || k === 'command') return isMac ? 'Command' : 'Control';
    if (k === 'win') return isWindows ? 'Super' : 'Command';
    if (k === 'option' || k === 'alt') return 'Alt';
    if (k === 'ctrl' || k === 'control') return 'Control';
    if (k === 'shift') return 'Shift';
    return k.charAt(0).toUpperCase() + k.slice(1);
  }).join('+');

  logger.info(`Registering Admin Unlock Shortcut: ${accelerator}`);

  // Unregister first in case it's already registered
  try {
    globalShortcut.unregister(accelerator);
  } catch (e) {
    // Ignore
  }

  // Register the global listener
  const success = globalShortcut.register(accelerator, () => {
    logger.info('🔐 Admin Unlock Sequence Detected!');
    
    if (mainWindow) {
      mainWindow.webContents.send('admin:request-unlock'); 
      mainWindow.webContents.send('show-admin-login');
    }
  });

  if (success) {
    logger.info(`✅ Admin shortcut registered successfully: ${accelerator}`);
  } else {
    logger.error(`❌ Failed to register admin shortcut: ${accelerator}`);
  }
}

module.exports = {
  getMainWindow: () => mainWindow,
  getPolicyEngine: () => policyEngine,
  getRuntimeManager: () => runtimeManager,
};
