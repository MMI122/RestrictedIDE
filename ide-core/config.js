/**
 * Restricted IDE - Configuration
 * 
 * Central configuration for the application.
 * Loads from environment and config files.
 * Cross-platform support for Windows and macOS.
 * 
 * @module ide-core/config
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Platform detection
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';
const forceKiosk = process.env.FORCE_KIOSK === 'true';  // Allow testing kiosk in dev mode

// Base paths - platform-specific
const appRoot = path.join(__dirname, '..');
let userDataPath;
if (isDevelopment) {
  userDataPath = path.join(appRoot, 'dev-data');
} else if (isWindows) {
  userDataPath = path.join(process.env.APPDATA || '', 'RestrictedIDE');
} else if (isMac) {
  userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'RestrictedIDE');
} else {
  userDataPath = path.join(process.env.HOME || '', '.restricted-ide');
}

// Ensure user data directory exists
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

/**
 * Load external config file if exists
 * @param {string} filename - Config filename
 * @returns {Object} Config object or empty object
 */
function loadConfigFile(filename) {
  const configPath = path.join(userDataPath, 'config', filename);
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error(`Failed to load config ${filename}:`, error.message);
  }
  return {};
}

// Load external configs
const policyConfig = loadConfigFile('policy.json');
const kioskConfig = loadConfigFile('kiosk.json');

/**
 * Main configuration object
 */
const config = {
  // Application info
  name: 'Restricted IDE',
  version: '0.1.0',
  
  // Environment
  isDevelopment,
  isProduction: !isDevelopment,
  
  // Debug settings (development only)
  openDevToolsOnStart: isDevelopment,
  
  // Paths
  paths: {
    root: appRoot,
    userData: userDataPath,
    logs: path.join(userDataPath, 'logs'),
    policies: path.join(userDataPath, 'policies'),
    config: path.join(userDataPath, 'config'),
    sandbox: path.join(userDataPath, 'sandbox'),
  },
  
  // Kiosk mode settings
  kioskMode: {
    // Enable kiosk mode (fullscreen, locked)
    // Can be forced in dev mode with FORCE_KIOSK=true
    enabled: forceKiosk || (kioskConfig.enabled ?? !isDevelopment),
    
    // Allow admin to close window
    adminCanClose: true,
    
    // Auto-start on boot (configured by installer)
    autoStart: kioskConfig.autoStart ?? false,
    
    // Secret key combo to access admin panel (platform-specific)
    adminAccessCombo: isWindows 
      ? (kioskConfig.adminAccessCombo_windows ?? kioskConfig.adminAccessCombo ?? ['ctrl', 'shift', 'alt', 'a'])
      : (kioskConfig.adminAccessCombo_darwin ?? kioskConfig.adminAccessCombo ?? ['cmd', 'shift', 'option', 'a']),
    
    // Timeout for admin panel (ms)
    adminTimeout: kioskConfig.adminTimeout ?? 300000, // 5 minutes
  },
  
  // Policy engine settings
  policy: {
    // Default policy file
    defaultPolicyPath: path.join(appRoot, 'installer', 'config', 'default-policy.json'),
    
    // User policy file (overrides default)
    userPolicyPath: path.join(userDataPath, 'policies', 'user-policy.json'),
    
    // Policy validation strictness
    strictValidation: policyConfig.strictValidation ?? true,
    
    // Log policy violations
    logViolations: policyConfig.logViolations ?? true,
  },
  
  // Input control settings
  inputControl: {
    // Block these key combinations - platform-specific
    blockedCombinations: isWindows ? [
      // Windows key combinations
      ['alt', 'tab'],           // Window switching
      ['alt', 'f4'],            // Close window
      ['alt', 'escape'],        // Switch windows
      ['ctrl', 'escape'],       // Start menu
      ['ctrl', 'shift', 'escape'], // Task manager
      ['win'],                  // Windows key
      ['win', 'd'],             // Show desktop
      ['win', 'e'],             // File explorer
      ['win', 'r'],             // Run dialog
      ['win', 'l'],             // Lock screen
      ['ctrl', 'alt', 'delete'], // Security options
      ['f11'],                  // Exit fullscreen
      ['f12'],                  // DevTools
      ['ctrl', 'shift', 'i'],   // DevTools
    ] : [
      // macOS key combinations
      ['cmd', 'tab'],           // App switching
      ['cmd', 'q'],             // Quit application
      ['cmd', 'w'],             // Close window
      ['cmd', 'space'],         // Spotlight
      ['cmd', 'option', 'escape'], // Force Quit
      ['cmd', 'h'],             // Hide window
      ['cmd', 'm'],             // Minimize
      ['control', 'up'],        // Mission Control
      ['control', 'down'],      // App Expose
      ['f11'],                  // Exit fullscreen
      ['f12'],                  // DevTools
      ['cmd', 'option', 'i'],   // DevTools
    ],
    
    // Mouse restriction settings
    mouseRestriction: {
      enabled: true,
      // Confine mouse to window bounds
      confineToWindow: true,
    },
  },
  
  // Process control settings
  processControl: {
    // Interval for checking processes (ms)
    monitorInterval: 2000,
    
/*  */    // Process whitelist - system processes that should always be allowed
    whitelist: isWindows ? [
      'csrss.exe',
      'smss.exe',
      'services.exe',
      'lsass.exe',
      'svchost.exe',
      'conhost.exe',
      'dwm.exe',
      'winlogon.exe',
      'wininit.exe',
      'System',
      'Idle',
      'restricted-ide.exe',
      'electron.exe',
      'node.exe',
    ] : [
      'kernel_task',
      'launchd',
      'WindowServer',
      'restricted-ide',
      'electron',
      'node',
    ],
    
    // Processes to immediately terminate - platform-specific
    blacklist: isWindows ? [
      'cmd.exe',
      'powershell.exe',
      'pwsh.exe',
      'taskmgr.exe',
      'regedit.exe',
      'mmc.exe',
      'control.exe',
      'notepad.exe',
      'calc.exe',
      'mspaint.exe',
      'chrome.exe',
      'firefox.exe',
      'msedge.exe',
      'iexplore.exe',
    ] : [
      'terminal',
      'iterm2',
      'activity monitor',
      'console',
      'textedit',
      'notes',
      'safari',
      'google chrome',
      'firefox',
    ],
    
    // Kill unauthorized processes
    killUnauthorized: true,
  },
  
  // File system sandbox settings
  fsSandbox: {
    // Base sandbox directory
    sandboxRoot: path.join(userDataPath, 'sandbox'),
    
    // Allowed file extensions
    allowedExtensions: [
      '.txt', '.md', '.json',
      '.js', '.ts', '.jsx', '.tsx',
      '.py', '.java', '.c', '.cpp', '.h',
      '.html', '.css', '.scss',
      '.xml', '.yaml', '.yml',
    ],
    
    // Max file size (bytes)
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    
    // Allowed read paths (besides sandbox)
    allowedReadPaths: [],
    
    // Deny access to these paths - platform-specific
    deniedPaths: isWindows ? [
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      process.env.USERPROFILE,
    ] : [
      '/System',
      '/Library',
      '/Applications',
      '/bin',
      '/usr/bin',
      '/sbin',
    ],
  },
  
  // Web viewer settings
  webViewer: {
    // URL whitelist (regex patterns)
    urlWhitelist: policyConfig.urlWhitelist ?? [
      /^https:\/\/developer\.mozilla\.org/,
      /^https:\/\/docs\.python\.org/,
      /^https:\/\/docs\.oracle\.com/,
      /^https:\/\/cplusplus\.com/,
      /^https:\/\/www\.w3schools\.com/,
    ],
    
    // Block all external URLs by default
    blockExternal: true,
    
    // Block downloads
    blockDownloads: true,
    
    // Block popups
    blockPopups: true,
  },
  
  // Logging settings
  logging: {
    // Log level: error, warn, info, debug
    level: isDevelopment ? 'debug' : 'info',
    
    // Max log file size (bytes)
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    
    // Max number of log files
    maxFiles: 10,
    
    // Log to console
    console: isDevelopment,
    
    // Log to file
    file: true,
  },
  
  // Admin panel settings
  admin: {
    // Session timeout (ms)
    sessionTimeout: 300000, // 5 minutes
    
    // Max login attempts before lockout
    maxLoginAttempts: 3,
    
    // Lockout duration (ms)
    lockoutDuration: 300000, // 5 minutes
    
    // Secret key combo - platform-specific
    secretKeyCombo: isWindows 
      ? ['ctrl', 'shift', 'alt', 'a']
      : ['cmd', 'shift', 'option', 'a'],
    secretKeyCombo_windows: ['ctrl', 'shift', 'alt', 'a'],
    secretKeyCombo_darwin: ['cmd', 'shift', 'option', 'a'],
    
    // Password requirements
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: true,
  },
  
  // IPC settings
  ipc: {
    // Timeout for IPC calls (ms)
    timeout: 5000,
    
    // Max message size
    maxMessageSize: 1024 * 1024, // 1 MB
  },
  
  // Editor settings
  editor: {
    // Default font size
    fontSize: 14,
    
    // Default theme
    theme: 'vs-dark',
    
    // Enable minimap
    minimap: true,
    
    // Word wrap
    wordWrap: 'on',
    
    // Tab size
    tabSize: 2,
  },
};

// Create required directories
Object.values(config.paths).forEach(dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

module.exports = config;
