/**
 * IPC Main - Main process IPC handlers
 * 
 * Handles all IPC communication from renderer processes.
 * All requests are validated through the policy engine.
 * 
 * @module ide-core/ipc/IpcMain
 */

'use strict';

const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { Logger } = require('../utils/Logger');
const { IpcChannels, isValidChannel, requiresAdmin } = require('./IpcChannels');
const config = require('../config');

const logger = new Logger('IpcMain');

/**
 * IpcMain - Main process IPC handler
 */
class IpcMain {
  /**
   * @param {PolicyEngine} policyEngine - Policy engine instance
   * @param {RuntimeManager} runtimeManager - Runtime manager instance
   * @param {SystemServiceManager} systemServiceManager - System service manager
   */
  constructor(policyEngine, runtimeManager, systemServiceManager) {
    this.policyEngine = policyEngine;
    this.runtimeManager = runtimeManager;
    this.systemServiceManager = systemServiceManager;
  }

  /**
   * Register all IPC handlers
   */
  registerHandlers() {
    logger.info('Registering IPC handlers...');

    // Policy handlers
    this.handle(IpcChannels.POLICY_VALIDATE_URL, this.handleValidateUrl.bind(this));
    this.handle(IpcChannels.POLICY_VALIDATE_KEYBOARD, this.handleValidateKeyboard.bind(this));
    this.handle(IpcChannels.POLICY_VALIDATE_FILE, this.handleValidateFile.bind(this));
    this.handle(IpcChannels.POLICY_GET, this.handleGetPolicy.bind(this));
    this.handle(IpcChannels.POLICY_UPDATE, this.handleUpdatePolicy.bind(this));

    // File system handlers
    this.handle(IpcChannels.FS_READ_FILE, this.handleReadFile.bind(this));
    this.handle(IpcChannels.FS_WRITE_FILE, this.handleWriteFile.bind(this));
    this.handle(IpcChannels.FS_DELETE_FILE, this.handleDeleteFile.bind(this));
    this.handle(IpcChannels.FS_LIST_DIR, this.handleListDir.bind(this));
    this.handle(IpcChannels.FS_CREATE_DIR, this.handleCreateDir.bind(this));
    this.handle(IpcChannels.FS_FILE_EXISTS, this.handleFileExists.bind(this));
    this.handle(IpcChannels.FS_GET_SANDBOX_PATH, this.handleGetSandboxPath.bind(this));

    // WebView handlers
    this.handle(IpcChannels.WEBVIEW_CAN_NAVIGATE, this.handleCanNavigate.bind(this));

    // Admin handlers
    this.handle(IpcChannels.ADMIN_LOGIN, this.handleAdminLogin.bind(this));
    this.handle(IpcChannels.ADMIN_LOGOUT, this.handleAdminLogout.bind(this));
    this.handle(IpcChannels.ADMIN_CHECK_SESSION, this.handleCheckAdminSession.bind(this));
    this.handle(IpcChannels.ADMIN_REQUEST_EXIT, this.handleRequestExit.bind(this));
    this.handle(IpcChannels.ADMIN_GET_LOGS, this.handleGetLogs.bind(this));

    // System handlers
    this.handle(IpcChannels.SYSTEM_GET_INFO, this.handleGetSystemInfo.bind(this));
    this.handle(IpcChannels.SYSTEM_GET_STATUS, this.handleGetSystemStatus.bind(this));

    // Runtime handlers
    this.handle(IpcChannels.RUNTIME_GET_STATE, this.handleGetRuntimeState.bind(this));
    this.handle(IpcChannels.RUNTIME_GET_SESSION, this.handleGetSession.bind(this));

    logger.info('IPC handlers registered');
  }

  /**
   * Register an IPC handler with validation
   * @private
   */
  handle(channel, handler) {
    if (!isValidChannel(channel)) {
      logger.warn(`Attempting to register invalid channel: ${channel}`);
      return;
    }

    ipcMain.handle(channel, async (event, ...args) => {
      const startTime = Date.now();
      
      try {
        // Log request
        logger.debug(`IPC Request: ${channel}`, args);

        // Check admin requirement
        if (requiresAdmin(channel)) {
          if (!this.runtimeManager?.isAdminAuthenticated()) {
            logger.warn(`Unauthorized admin request: ${channel}`);
            throw new Error('Admin authentication required');
          }
        }

        // Execute handler
        const result = await handler(event, ...args);

        // Log response
        const duration = Date.now() - startTime;
        logger.debug(`IPC Response: ${channel} (${duration}ms)`);

        return { success: true, data: result };
      } catch (error) {
        logger.error(`IPC Error: ${channel}`, error.message);
        return { success: false, error: error.message };
      }
    });
  }

  // ============================================
  // Policy Handlers
  // ============================================

  async handleValidateUrl(event, url) {
    return this.policyEngine.validateUrl(url);
  }

  async handleValidateKeyboard(event, keys) {
    return this.policyEngine.validateKeyboard(keys);
  }

  async handleValidateFile(event, filePath, operation) {
    return this.policyEngine.validateFileAccess(filePath, operation);
  }

  async handleGetPolicy(event) {
    return this.policyEngine.getPolicy();
  }

  async handleUpdatePolicy(event, newPolicy) {
    return this.policyEngine.updatePolicy(newPolicy);
  }

  // ============================================
  // File System Handlers
  // ============================================

  async handleReadFile(event, filePath) {
    // Validate access
    const validation = this.policyEngine.validateFileAccess(filePath, 'read');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const content = await fs.readFile(filePath, 'utf8');
    return content;
  }

  async handleWriteFile(event, filePath, content) {
    // Validate access
    const validation = this.policyEngine.validateFileAccess(filePath, 'write');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, content, 'utf8');
    logger.audit('FILE_WRITE', { filePath });
    return true;
  }

  async handleDeleteFile(event, filePath) {
    // Validate access
    const validation = this.policyEngine.validateFileAccess(filePath, 'delete');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    await fs.unlink(filePath);
    logger.audit('FILE_DELETE', { filePath });
    return true;
  }

  async handleListDir(event, dirPath) {
    // Validate access
    const validation = this.policyEngine.validateFileAccess(dirPath, 'read');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
      path: path.join(dirPath, entry.name),
    }));
  }

  async handleCreateDir(event, dirPath) {
    // Validate access
    const validation = this.policyEngine.validateFileAccess(dirPath, 'write');
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    await fs.mkdir(dirPath, { recursive: true });
    logger.audit('DIR_CREATE', { dirPath });
    return true;
  }

  async handleFileExists(event, filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async handleGetSandboxPath(event) {
    return config.fsSandbox.sandboxRoot;
  }

  // ============================================
  // WebView Handlers
  // ============================================

  async handleCanNavigate(event, url) {
    return this.policyEngine.validateUrl(url);
  }

  // ============================================
  // Admin Handlers
  // ============================================

  async handleAdminLogin(event, password) {
    return this.runtimeManager.authenticateAdmin(password);
  }

  async handleAdminLogout(event) {
    return this.runtimeManager.logoutAdmin();
  }

  async handleCheckAdminSession(event) {
    return this.runtimeManager.isAdminAuthenticated();
  }

  async handleRequestExit(event) {
    logger.security('ADMIN_EXIT_REQUESTED');
    return this.runtimeManager.requestAdminExit();
  }

  async handleGetLogs(event, options = {}) {
    const { date, level, limit = 1000 } = options;
    const logDir = config.paths.logs;
    
    // Get log files
    const files = await fs.readdir(logDir);
    const logFiles = files.filter(f => f.endsWith('.log')).sort().reverse();
    
    if (logFiles.length === 0) {
      return [];
    }

    // Read most recent log file
    const targetFile = date 
      ? `restricted-ide-${date}.log`
      : logFiles[0];
    
    const logPath = path.join(logDir, targetFile);
    
    try {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.trim().split('\n');
      
      let entries = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null);

      // Filter by level
      if (level) {
        entries = entries.filter(e => e.level === level.toUpperCase());
      }

      // Limit results
      return entries.slice(-limit);
    } catch (error) {
      return [];
    }
  }

  // ============================================
  // System Handlers
  // ============================================

  async handleGetSystemInfo(event) {
    return {
      version: config.version,
      name: config.name,
      environment: config.isDevelopment ? 'development' : 'production',
      kioskMode: config.kioskMode.enabled,
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
    };
  }

  async handleGetSystemStatus(event) {
    return {
      policyEngineReady: this.policyEngine?.isInitialized() || false,
      systemServicesReady: this.systemServiceManager?.isRunning() || false,
      adminAuthenticated: this.runtimeManager?.isAdminAuthenticated() || false,
      uptime: process.uptime(),
    };
  }

  // ============================================
  // Runtime Handlers
  // ============================================

  async handleGetRuntimeState(event) {
    return this.runtimeManager?.getState() || {};
  }

  async handleGetSession(event) {
    return this.runtimeManager?.getSession() || null;
  }

  /**
   * Send notification to renderer
   * @param {BrowserWindow} window - Target window
   * @param {string} channel - Notification channel
   * @param {*} data - Notification data
   */
  notify(window, channel, data) {
    if (window && !window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  }
}

module.exports = { IpcMain };
