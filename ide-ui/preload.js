/**
 * Preload Script - Secure IPC Bridge
 * 
 * This script runs in the renderer process with access to Node.js APIs,
 * but exposes only a restricted API to the renderer through contextBridge.
 * 
 * SECURITY: This is the ONLY way for the renderer to communicate with main process.
 * 
 * @module ide-ui/preload
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Allowed IPC channels (must match IpcChannels.js)
 */
const ALLOWED_CHANNELS = {
  // Policy channels
  send: [
    'policy:validate-url',
    'policy:validate-keyboard',
    'policy:validate-file',
    'policy:get',
    'policy:update',
  ],
  
  // File system channels
  fs: [
    'fs:read-file',
    'fs:write-file',
    'fs:delete-file',
    'fs:list-dir',
    'fs:create-dir',
    'fs:file-exists',
    'fs:get-sandbox-path',
  ],
  
  // Editor channels
  editor: [
    'editor:open-file',
    'editor:save-file',
    'editor:get-content',
  ],
  
  // WebView channels
  webview: [
    'webview:navigate',
    'webview:can-navigate',
    'webview:go-back',
    'webview:go-forward',
    'webview:reload',
  ],
  
  // Admin channels
  admin: [
    'admin:login',
    'admin:logout',
    'admin:check-session',
    'admin:request-exit',
    'admin:get-logs',
    'admin:clear-logs',
    'admin:unlock-window',
  ],
  
  // System channels
  system: [
    'system:get-info',
    'system:get-status',
    'system:restart',
  ],
  
  // Runtime channels
  runtime: [
    'runtime:get-state',
    'runtime:get-session',
  ],
  
  // Notification channels (receive only)
  receive: [
    'notify:policy-violation',
    'notify:system-message',
    'notify:session-warning',
    'notify:time-warning',
    // --- ADDED THESE TWO LINES ---
    'admin:request-unlock',
    'show-admin-login'
  ],
};

// Flatten all invoke channels
const ALL_INVOKE_CHANNELS = [
  ...ALLOWED_CHANNELS.send,
  ...ALLOWED_CHANNELS.fs,
  ...ALLOWED_CHANNELS.editor,
  ...ALLOWED_CHANNELS.webview,
  ...ALLOWED_CHANNELS.admin,
  ...ALLOWED_CHANNELS.system,
  ...ALLOWED_CHANNELS.runtime,
];

/**
 * Validate channel is allowed
 * @param {string} channel - Channel name
 * @param {string[]} allowedList - Allowed channels
 * @returns {boolean}
 */
function isAllowedChannel(channel, allowedList) {
  return allowedList.includes(channel);
}

/**
 * Exposed API to renderer process
 */
const exposedApi = {
  /**
   * Invoke a main process handler
   * @param {string} channel - IPC channel
   * @param {...any} args - Arguments
   * @returns {Promise<any>} Response from main process
   */
  invoke: async (channel, ...args) => {
    if (!isAllowedChannel(channel, ALL_INVOKE_CHANNELS)) {
      console.error(`Blocked IPC invoke to unauthorized channel: ${channel}`);
      throw new Error('Unauthorized IPC channel');
    }
    
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Subscribe to notifications from main process
   * @param {string} channel - Notification channel
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on: (channel, callback) => {
    if (!isAllowedChannel(channel, ALLOWED_CHANNELS.receive)) {
      console.error(`Blocked subscription to unauthorized channel: ${channel}`);
      throw new Error('Unauthorized notification channel');
    }
    
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  /**
   * Subscribe to one-time notification
   * @param {string} channel - Notification channel
   * @param {Function} callback - Callback function
   */
  once: (channel, callback) => {
    if (!isAllowedChannel(channel, ALLOWED_CHANNELS.receive)) {
      console.error(`Blocked one-time subscription to unauthorized channel: ${channel}`);
      throw new Error('Unauthorized notification channel');
    }
    
    ipcRenderer.once(channel, (event, ...args) => callback(...args));
  },

  // ============================================
  // Convenience API methods
  // ============================================

  /**
   * Policy API
   */
  policy: {
    validateUrl: (url) => ipcRenderer.invoke('policy:validate-url', url),
    validateKeyboard: (keys) => ipcRenderer.invoke('policy:validate-keyboard', keys),
    validateFile: (path, op) => ipcRenderer.invoke('policy:validate-file', path, op),
    get: () => ipcRenderer.invoke('policy:get'),
    update: (policy) => ipcRenderer.invoke('policy:update', policy),
  },

  /**
   * File System API
   */
  fs: {
    readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:write-file', path, content),
    deleteFile: (path) => ipcRenderer.invoke('fs:delete-file', path),
    listDir: (path) => ipcRenderer.invoke('fs:list-dir', path),
    createDir: (path) => ipcRenderer.invoke('fs:create-dir', path),
    fileExists: (path) => ipcRenderer.invoke('fs:file-exists', path),
    getSandboxPath: () => ipcRenderer.invoke('fs:get-sandbox-path'),
  },

  /**
   * WebView API
   */
  webview: {
    canNavigate: (url) => ipcRenderer.invoke('webview:can-navigate', url),
  },

  /**
   * Admin API
   */
  admin: {
    login: (password) => ipcRenderer.invoke('admin:login', password),
    logout: () => ipcRenderer.invoke('admin:logout'),
    checkSession: () => ipcRenderer.invoke('admin:check-session'),
    requestExit: () => ipcRenderer.invoke('admin:request-exit'),
    getLogs: (options) => ipcRenderer.invoke('admin:get-logs', options),
    unlockWindow: () => ipcRenderer.invoke('admin:unlock-window'),
  },

  /**
   * System API
   */
  system: {
    getInfo: () => ipcRenderer.invoke('system:get-info'),
    getStatus: () => ipcRenderer.invoke('system:get-status'),
  },

  /**
   * Runtime API
   */
  runtime: {
    getState: () => ipcRenderer.invoke('runtime:get-state'),
    getSession: () => ipcRenderer.invoke('runtime:get-session'),
  },
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('restrictedIDE', exposedApi);

// Log that preload script loaded
console.log('Restricted IDE preload script loaded');
