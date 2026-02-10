/**
 * IPC Main - Main process IPC handlers
 * 
 * Handles all IPC communication from renderer processes.
 * All requests are validated through the policy engine.
 * 
 * @module ide-core/ipc/IpcMain
 */

'use strict';

const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
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
    this.runningProcess = null; // Currently running code process
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

    // Code execution handlers
    this.handle(IpcChannels.CODE_RUN, this.handleRunCode.bind(this));
    this.handle(IpcChannels.CODE_STOP, this.handleStopCode.bind(this));
    this.handle(IpcChannels.CODE_INPUT, this.handleCodeInput.bind(this));

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
        logger.error(`IPC Error: ${channel} - ${error.message || error}`);
        if (error.stack) {
          logger.error(`Stack: ${error.stack}`);
        }
        return { success: false, error: error.message || 'Unknown error' };
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

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, 'utf8');
      logger.audit('FILE_WRITE', { filePath });
      return true;
    } catch (error) {
      logger.error(`File write failed: ${filePath} - ${error.message}`);
      throw error;
    }
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
    logger.debug(`handleListDir called with: ${dirPath}`);
    
    // Validate access
    const validation = this.policyEngine.validateFileAccess(dirPath, 'read');
    logger.debug(`handleListDir validation result: ${JSON.stringify(validation)}`);
    
    if (!validation.allowed) {
      logger.error(`handleListDir - Access denied: ${validation.reason}`);
      throw new Error(validation.reason || 'Access denied');
    }

    try {
      logger.debug(`handleListDir - Calling fs.readdir on: ${dirPath}`);
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      logger.debug(`handleListDir - Got ${entries.length} entries`);
      return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        path: path.join(dirPath, entry.name),
      }));
    } catch (error) {
      logger.error(`List dir failed: ${dirPath} - ${error.message} - ${error.code}`);
      throw error;
    }
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
    const result = this.runtimeManager.requestAdminExit();
    
    if (result) {
      // Actually quit the app after a short delay
      const { app } = require('electron');
      setTimeout(() => {
        logger.info('Admin exit: Quitting application');
        app.quit();
      }, 100);
    }
    
    return result;
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

  // ============================================
  // Code Execution Handlers (SECURE)
  // ============================================

  /**
   * Supported languages and their execution commands
   * SECURITY: Only these exact executables are allowed.
   * No shell, no flags that could be abused.
   */
  static LANGUAGE_CONFIG = {
    '.py': {
      name: 'Python',
      commands: [
        { cmd: 'python', args: (file) => [file] },
        { cmd: 'python3', args: (file) => [file] },
      ],
    },
    '.js': {
      name: 'JavaScript (Node.js)',
      commands: [
        { cmd: 'node', args: (file) => [file] },
      ],
    },
    '.cpp': {
      name: 'C++',
      compile: true,
      commands: [
        { cmd: 'g++', args: (file, outFile) => [file, '-o', outFile] },
      ],
      runCompiled: (outFile) => ({ cmd: outFile, args: [] }),
    },
    '.c': {
      name: 'C',
      compile: true,
      commands: [
        { cmd: 'gcc', args: (file, outFile) => [file, '-o', outFile] },
      ],
      runCompiled: (outFile) => ({ cmd: outFile, args: [] }),
    },
    '.java': {
      name: 'Java',
      compile: true,
      commands: [
        { cmd: 'javac', args: (file) => [file] },
      ],
      runCompiled: (outFile, dir, className) => ({ cmd: 'java', args: ['-cp', dir, className] }),
    },
  };

  /**
   * Maximum execution time (30 seconds)
   */
  static MAX_EXECUTION_TIME = 30000;

  /**
   * Run code from a file - SECURE execution
   */
  async handleRunCode(event, filePath) {
    // Kill any existing process
    this.killRunningProcess();

    // Validate file is in sandbox
    const fileAccess = this.policyEngine.validateFileAccess(filePath, 'read');
    if (!fileAccess.allowed) {
      throw new Error(`Access denied: ${fileAccess.reason}`);
    }

    // Check file exists
    await fs.access(filePath);

    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const langConfig = IpcMain.LANGUAGE_CONFIG[ext];

    if (!langConfig) {
      throw new Error(`Unsupported language: ${ext}. Supported: ${Object.keys(IpcMain.LANGUAGE_CONFIG).join(', ')}`);
    }

    const window = BrowserWindow.fromWebContents(event.sender);
    const workingDir = path.dirname(filePath);

    logger.info(`Running ${langConfig.name} file: ${filePath}`);

    // Send status to renderer
    this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
      type: 'info',
      text: `▶ Running ${langConfig.name}: ${path.basename(filePath)}\n`,
    });

    if (langConfig.compile) {
      // Compile first, then run
      await this.compileAndRun(event, filePath, langConfig, workingDir, window);
    } else {
      // Interpreted language - run directly
      await this.runInterpreted(event, filePath, langConfig, workingDir, window);
    }

    return { running: true, language: langConfig.name };
  }

  /**
   * Run an interpreted language file
   */
  async runInterpreted(event, filePath, langConfig, workingDir, window) {
    const cmdConfig = langConfig.commands[0];
    
    const child = spawn(cmdConfig.cmd, cmdConfig.args(filePath), {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,  // SECURITY: No shell access
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME || process.env.USERPROFILE,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        // Don't pass other env vars - security measure
      },
      windowsHide: true,
    });

    this.setupProcessHandlers(child, window);
  }

  /**
   * Compile and run a compiled language file
   */
  async compileAndRun(event, filePath, langConfig, workingDir, window) {
    const baseName = path.basename(filePath, path.extname(filePath));
    const outFile = path.join(workingDir, process.platform === 'win32' ? `${baseName}.exe` : baseName);
    const cmdConfig = langConfig.commands[0];

    this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
      type: 'info',
      text: `⏳ Compiling...\n`,
    });

    return new Promise((resolve, reject) => {
      const compiler = spawn(cmdConfig.cmd, cmdConfig.args(filePath, outFile), {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME || process.env.USERPROFILE,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
        },
        windowsHide: true,
      });

      let compileErrors = '';

      compiler.stderr.on('data', (data) => {
        compileErrors += data.toString();
        this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
          type: 'stderr',
          text: data.toString(),
        });
      });

      compiler.on('close', (code) => {
        if (code !== 0) {
          this.notify(window, IpcChannels.NOTIFY_CODE_EXIT, {
            code,
            signal: null,
            error: 'Compilation failed',
          });
          resolve();
          return;
        }

        this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
          type: 'info',
          text: '✅ Compiled. Running...\n',
        });

        // Now run the compiled binary
        let runConfig;
        if (path.extname(filePath) === '.java') {
          runConfig = langConfig.runCompiled(outFile, workingDir, baseName);
        } else {
          runConfig = langConfig.runCompiled(outFile);
        }

        const child = spawn(runConfig.cmd, runConfig.args, {
          cwd: workingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME || process.env.USERPROFILE,
            TEMP: process.env.TEMP,
            TMP: process.env.TMP,
          },
          windowsHide: true,
        });

        this.setupProcessHandlers(child, window);
        resolve();
      });

      compiler.on('error', (err) => {
        this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
          type: 'stderr',
          text: `Compiler not found: ${cmdConfig.cmd}. Make sure it's installed and in your PATH.\n`,
        });
        this.notify(window, IpcChannels.NOTIFY_CODE_EXIT, {
          code: 1,
          signal: null,
          error: err.message,
        });
        resolve();
      });
    });
  }

  /**
   * Setup stdout/stderr/exit handlers for a child process
   */
  setupProcessHandlers(child, window) {
    this.runningProcess = child;

    // Timeout - kill process after MAX_EXECUTION_TIME
    const timer = setTimeout(() => {
      if (this.runningProcess === child) {
        this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
          type: 'stderr',
          text: `\n⏱ Process killed: exceeded ${IpcMain.MAX_EXECUTION_TIME / 1000}s time limit.\n`,
        });
        this.killRunningProcess();
      }
    }, IpcMain.MAX_EXECUTION_TIME);

    child.stdout.on('data', (data) => {
      this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
        type: 'stdout',
        text: data.toString(),
      });
    });

    child.stderr.on('data', (data) => {
      this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
        type: 'stderr',
        text: data.toString(),
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (this.runningProcess === child) {
        this.runningProcess = null;
      }
      this.notify(window, IpcChannels.NOTIFY_CODE_EXIT, {
        code,
        signal,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (this.runningProcess === child) {
        this.runningProcess = null;
      }
      this.notify(window, IpcChannels.NOTIFY_CODE_OUTPUT, {
        type: 'stderr',
        text: `Error: ${err.message}. Make sure the language runtime is installed and in your PATH.\n`,
      });
      this.notify(window, IpcChannels.NOTIFY_CODE_EXIT, {
        code: 1,
        signal: null,
        error: err.message,
      });
    });
  }

  /**
   * Send input to running process (for interactive programs)
   */
  async handleCodeInput(event, text) {
    if (!this.runningProcess || this.runningProcess.killed) {
      throw new Error('No running process');
    }

    try {
      this.runningProcess.stdin.write(text + '\n');
    } catch (err) {
      logger.error(`Failed to send input: ${err.message}`);
      throw new Error('Failed to send input to process');
    }

    return true;
  }

  /**
   * Stop the running process
   */
  async handleStopCode(event) {
    if (!this.runningProcess) {
      return { stopped: false, reason: 'No running process' };
    }

    this.killRunningProcess();
    return { stopped: true };
  }

  /**
   * Kill the currently running process
   */
  killRunningProcess() {
    if (this.runningProcess && !this.runningProcess.killed) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', this.runningProcess.pid.toString(), '/f', '/t'], { windowsHide: true });
        } else {
          this.runningProcess.kill('SIGKILL');
        }
      } catch (err) {
        logger.error(`Failed to kill process: ${err.message}`);
      }
      this.runningProcess = null;
    }
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
