/**
 * IPC Channels - Defines all IPC communication channels
 * 
 * All communication between main and renderer processes
 * must use these defined channels.
 * 
 * @module ide-core/ipc/IpcChannels
 */

'use strict';

/**
 * IPC Channel definitions
 * Format: CATEGORY:ACTION
 */
const IpcChannels = {
  // ============================================
  // Policy channels
  // ============================================
  POLICY_VALIDATE_URL: 'policy:validate-url',
  POLICY_VALIDATE_KEYBOARD: 'policy:validate-keyboard',
  POLICY_VALIDATE_FILE: 'policy:validate-file',
  POLICY_GET: 'policy:get',
  POLICY_UPDATE: 'policy:update',

  // ============================================
  // File system channels
  // ============================================
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_DELETE_FILE: 'fs:delete-file',
  FS_LIST_DIR: 'fs:list-dir',
  FS_CREATE_DIR: 'fs:create-dir',
  FS_FILE_EXISTS: 'fs:file-exists',
  FS_GET_SANDBOX_PATH: 'fs:get-sandbox-path',

  // ============================================
  // Editor channels
  // ============================================
  EDITOR_OPEN_FILE: 'editor:open-file',
  EDITOR_SAVE_FILE: 'editor:save-file',
  EDITOR_GET_CONTENT: 'editor:get-content',

  // ============================================
  // WebView channels
  // ============================================
  WEBVIEW_NAVIGATE: 'webview:navigate',
  WEBVIEW_CAN_NAVIGATE: 'webview:can-navigate',
  WEBVIEW_GO_BACK: 'webview:go-back',
  WEBVIEW_GO_FORWARD: 'webview:go-forward',
  WEBVIEW_RELOAD: 'webview:reload',

  // ============================================
  // Admin channels
  // ============================================
  ADMIN_LOGIN: 'admin:login',
  ADMIN_LOGOUT: 'admin:logout',
  ADMIN_CHECK_SESSION: 'admin:check-session',
  ADMIN_REQUEST_EXIT: 'admin:request-exit',
  ADMIN_GET_LOGS: 'admin:get-logs',
  ADMIN_CLEAR_LOGS: 'admin:clear-logs',

  // ============================================
  // System channels
  // ============================================
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_GET_STATUS: 'system:get-status',
  SYSTEM_RESTART: 'system:restart',

  // ============================================
  // Runtime channels
  // ============================================
  RUNTIME_GET_STATE: 'runtime:get-state',
  RUNTIME_GET_SESSION: 'runtime:get-session',

  // ============================================
  // Code execution channels
  // ============================================
  CODE_RUN: 'code:run',
  CODE_STOP: 'code:stop',
  CODE_INPUT: 'code:input',

  // ============================================
  // Notification channels (main to renderer)
  // ============================================
  NOTIFY_POLICY_VIOLATION: 'notify:policy-violation',
  NOTIFY_SYSTEM_MESSAGE: 'notify:system-message',
  NOTIFY_SESSION_WARNING: 'notify:session-warning',
  NOTIFY_TIME_WARNING: 'notify:time-warning',
  NOTIFY_CODE_OUTPUT: 'notify:code-output',
  NOTIFY_CODE_EXIT: 'notify:code-exit',
};

/**
 * Channel categories for validation
 */
const ChannelCategories = {
  POLICY: 'policy',
  FS: 'fs',
  EDITOR: 'editor',
  WEBVIEW: 'webview',
  ADMIN: 'admin',
  SYSTEM: 'system',
  RUNTIME: 'runtime',
  NOTIFY: 'notify',
};

/**
 * Get category from channel name
 * @param {string} channel - Channel name
 * @returns {string|null} Category name
 */
function getChannelCategory(channel) {
  const parts = channel.split(':');
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Check if channel is valid
 * @param {string} channel - Channel name
 * @returns {boolean} Whether channel is valid
 */
function isValidChannel(channel) {
  return Object.values(IpcChannels).includes(channel);
}

/**
 * Check if channel requires admin privileges
 * @param {string} channel - Channel name
 * @returns {boolean} Whether admin is required
 */
function requiresAdmin(channel) {
  const adminChannels = [
    IpcChannels.POLICY_UPDATE,
    IpcChannels.ADMIN_REQUEST_EXIT,
    IpcChannels.ADMIN_CLEAR_LOGS,
    IpcChannels.SYSTEM_RESTART,
  ];
  return adminChannels.includes(channel);
}

module.exports = {
  IpcChannels,
  ChannelCategories,
  getChannelCategory,
  isValidChannel,
  requiresAdmin,
};
