/**
 * System Service Manager - Native module coordination
 * 
 * Manages the lifecycle of native OS-level services:
 * - Input Control (keyboard/mouse hooks)
 * - Process Control (process monitoring)
 * - File System Sandbox
 * 
 * @module ide-core/runtime/SystemServiceManager
 */

'use strict';

const { Logger } = require('../utils/Logger');
const config = require('../config');

const logger = new Logger('SystemServiceManager');

/**
 * SystemServiceManager - Coordinates native system services
 */
class SystemServiceManager {
  /**
   * @param {PolicyEngine} policyEngine - Policy engine instance
   */
  constructor(policyEngine) {
    this.policyEngine = policyEngine;
    
    /** @type {Object|null} Input control service */
    this.inputControl = null;
    
    /** @type {Object|null} Process control service */
    this.processControl = null;
    
    /** @type {Object|null} File system sandbox service */
    this.fsSandbox = null;
    
    /** @type {boolean} Whether services are running */
    this.running = false;
    
    /** @type {boolean} Whether services are initialized */
    this.initialized = false;
  }

  /**
   * Initialize all system services
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('Initializing system services...');

    // Load native modules
    await this.loadNativeModules();
    
    this.initialized = true;
    logger.info('System services initialized');
  }

  /**
   * Load native modules
   * @private
   */
  async loadNativeModules() {
    // Input Control Module
    try {
      this.inputControl = require('../../system-services/input-control');
      logger.info('Input control module loaded');
    } catch (error) {
      logger.warn(`Failed to load input control module: ${error.message}`);
      if (!config.isDevelopment) {
        throw new Error('Input control module is required in production');
      }
    }

    // Process Control Module
    try {
      this.processControl = require('../../system-services/process-control');
      logger.info('Process control module loaded');
    } catch (error) {
      logger.warn(`Failed to load process control module: ${error.message}`);
      if (!config.isDevelopment) {
        throw new Error('Process control module is required in production');
      }
    }

    // File System Sandbox Module
    try {
      this.fsSandbox = require('../../system-services/fs-sandbox');
      logger.info('File system sandbox module loaded');
    } catch (error) {
      logger.warn(`Failed to load file system sandbox module: ${error.message}`);
      if (!config.isDevelopment) {
        throw new Error('File system sandbox module is required in production');
      }
    }
  }

  /**
   * Start all system services
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.initialized) {
      throw new Error('Services not initialized');
    }

    if (this.running) {
      logger.warn('Services already running');
      return;
    }

    logger.info('Starting system services...');

    // Start input control
    if (this.inputControl && config.kioskMode.enabled) {
      await this.startInputControl();
    }

    // Start process control
    if (this.processControl && config.kioskMode.enabled) {
      await this.startProcessControl();
    }

    // Start file system sandbox
    if (this.fsSandbox) {
      await this.startFsSandbox();
    }

    this.running = true;
    logger.info('System services started');
  }

  /**
   * Start input control service
   * @private
   */
  async startInputControl() {
    logger.info('Starting input control...');

    try {
      // Configure blocked key combinations from policy
      const blockedCombos = config.inputControl.blockedCombinations;
      
      // Initialize keyboard hook
      if (this.inputControl.initKeyboardHook) {
        this.inputControl.initKeyboardHook((keys) => {
          // Validate through policy engine
          const allowed = this.policyEngine.validateKeyboard(keys);
          return allowed;
        });
      }

      // Set blocked combinations
      if (this.inputControl.setBlockedCombinations) {
        this.inputControl.setBlockedCombinations(blockedCombos);
      }

      // Configure mouse restriction
      if (config.inputControl.mouseRestriction.enabled) {
        if (this.inputControl.enableMouseRestriction) {
          this.inputControl.enableMouseRestriction(
            config.inputControl.mouseRestriction.confineToWindow
          );
        }
      }

      logger.info('Input control started');
    } catch (error) {
      logger.error('Failed to start input control:', error.message);
      throw error;
    }
  }

  /**
   * Start process control service
   * @private
   */
  async startProcessControl() {
    logger.info('Starting process control...');

    try {
      // Configure process whitelist/blacklist
      if (this.processControl.setWhitelist) {
        this.processControl.setWhitelist(config.processControl.whitelist);
      }

      if (this.processControl.setBlacklist) {
        this.processControl.setBlacklist(config.processControl.blacklist);
      }

      // Start monitoring
      if (this.processControl.startMonitoring) {
        this.processControl.startMonitoring({
          interval: config.processControl.monitorInterval,
          onUnauthorized: (processInfo) => {
            logger.security('UNAUTHORIZED_PROCESS', processInfo);
            
            // Validate through policy engine
            const allowed = this.policyEngine.validateProcess(processInfo.name);
            
            if (!allowed && config.processControl.killUnauthorized) {
              this.killProcess(processInfo.pid);
            }
            
            return allowed;
          },
        });
      }

      logger.info('Process control started');
    } catch (error) {
      logger.error('Failed to start process control:', error.message);
      throw error;
    }
  }

  /**
   * Start file system sandbox service
   * @private
   */
  async startFsSandbox() {
    logger.info('Starting file system sandbox...');

    try {
      // Configure sandbox
      if (this.fsSandbox.configure) {
        this.fsSandbox.configure({
          sandboxRoot: config.fsSandbox.sandboxRoot,
          allowedExtensions: config.fsSandbox.allowedExtensions,
          maxFileSize: config.fsSandbox.maxFileSize,
          deniedPaths: config.fsSandbox.deniedPaths,
        });
      }

      // Initialize sandbox
      if (this.fsSandbox.initialize) {
        this.fsSandbox.initialize();
      }

      logger.info('File system sandbox started');
    } catch (error) {
      logger.error('Failed to start file system sandbox:', error.message);
      throw error;
    }
  }

  /**
   * Kill a process by PID
   * @param {number} pid - Process ID
   * @returns {boolean} Success
   */
  killProcess(pid) {
    try {
      if (this.processControl && this.processControl.killProcess) {
        this.processControl.killProcess(pid);
        logger.security('PROCESS_KILLED', { pid });
        return true;
      }
      
      // Fallback to Node.js
      process.kill(pid, 'SIGTERM');
      logger.security('PROCESS_KILLED', { pid, method: 'nodejs' });
      return true;
    } catch (error) {
      logger.error(`Failed to kill process ${pid}:`, error.message);
      return false;
    }
  }

  /**
   * Stop all system services
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return;
    }

    logger.info('Stopping system services...');

    // Stop input control
    if (this.inputControl) {
      try {
        if (this.inputControl.stopKeyboardHook) {
          this.inputControl.stopKeyboardHook();
        }
        if (this.inputControl.disableMouseRestriction) {
          this.inputControl.disableMouseRestriction();
        }
      } catch (error) {
        logger.error('Error stopping input control:', error.message);
      }
    }

    // Stop process control
    if (this.processControl) {
      try {
        if (this.processControl.stopMonitoring) {
          this.processControl.stopMonitoring();
        }
      } catch (error) {
        logger.error('Error stopping process control:', error.message);
      }
    }

    // Stop file system sandbox
    if (this.fsSandbox) {
      try {
        if (this.fsSandbox.shutdown) {
          this.fsSandbox.shutdown();
        }
      } catch (error) {
        logger.error('Error stopping file system sandbox:', error.message);
      }
    }

    this.running = false;
    logger.info('System services stopped');
  }

  /**
   * Check if services are running
   * @returns {boolean}
   */
  isRunning() {
    return this.running;
  }

  /**
   * Check if services are initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get service status
   * @returns {Object} Status of each service
   */
  getStatus() {
    return {
      initialized: this.initialized,
      running: this.running,
      inputControl: {
        loaded: !!this.inputControl,
        active: this.running && !!this.inputControl,
      },
      processControl: {
        loaded: !!this.processControl,
        active: this.running && !!this.processControl,
      },
      fsSandbox: {
        loaded: !!this.fsSandbox,
        active: this.running && !!this.fsSandbox,
      },
    };
  }
}

module.exports = { SystemServiceManager };
