/**
 * Restricted IDE - Configuration
 * 
 * Central configuration for the application.
 * Loads from environment and config files.
 * 
 * @module ide-core/config
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Base paths
const appRoot = path.join(__dirname, '..');
const userDataPath = isDevelopment 
  ? path.join(appRoot, 'dev-data')
  : path.join(process.env.APPDATA || process.env.HOME, 'RestrictedIDE');

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
    enabled: kioskConfig.enabled ?? !isDevelopment,
    
    // Allow admin to close window
    adminCanClose: true,
    
    // Auto-start on boot (configured by installer)
    autoStart: kioskConfig.autoStart ?? false,
    
    // Secret key combo to access admin panel
    // Default: Ctrl+Shift+Alt+A
    adminAccessCombo: kioskConfig.adminAccessCombo ?? ['ctrl', 'shift', 'alt', 'a'],
    
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
    // Block these key combinations
    blockedCombinations: [
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
      ['f11'],                  // Exit fullscreen (browser)
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
    monitorInterval: 1000,
    
    // Process whitelist (besides our own)
    whitelist: [
      'csrss.exe',
      'smss.exe',
      'services.exe',
      'lsass.exe',
      'svchost.exe',
      'conhost.exe',
      'dwm.exe',
      'winlogon.exe',
      'System',
      'Idle',
    ],
    
    // Processes to immediately terminate
    blacklist: [
      'cmd.exe',
      'powershell.exe',
      'taskmgr.exe',
      'explorer.exe',
      'regedit.exe',
      'mmc.exe',
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
    
    // Deny access to these paths
    deniedPaths: [
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      process.env.USERPROFILE,
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
