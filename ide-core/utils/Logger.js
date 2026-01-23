/**
 * Logger - Centralized logging utility
 * 
 * Provides structured logging with file and console output.
 * All security-relevant events should be logged through this module.
 * 
 * @module ide-core/utils/Logger
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Get config (avoid circular dependency)
const getConfig = () => {
  try {
    return require('../config');
  } catch {
    return {
      isDevelopment: process.env.NODE_ENV === 'development',
      logging: {
        level: 'info',
        console: true,
        file: true,
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 10,
      },
      paths: {
        logs: path.join(__dirname, '..', '..', 'logs'),
      },
    };
  }
};

/**
 * Logger class for structured logging
 */
class Logger {
  /**
   * @param {string} module - Module name for log context
   */
  constructor(module) {
    this.module = module;
    this.config = getConfig();
    this.level = LOG_LEVELS[this.config.logging?.level] ?? LOG_LEVELS.info;
    
    // Ensure log directory exists
    const logDir = this.config.paths?.logs;
    if (logDir && !fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Format a log message
   * @private
   */
  formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      }
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    }).join(' ');

    return {
      timestamp,
      level: level.toUpperCase(),
      module: this.module,
      message,
      formatted: `[${timestamp}] [${level.toUpperCase()}] [${this.module}] ${message}`,
    };
  }

  /**
   * Write log entry
   * @private
   */
  log(level, ...args) {
    if (LOG_LEVELS[level] > this.level) {
      return;
    }

    const entry = this.formatMessage(level, args);

    // Console output
    if (this.config.logging?.console !== false) {
      const consoleMethod = level === 'error' ? 'error' : 
                           level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](entry.formatted);
    }

    // File output
    if (this.config.logging?.file !== false) {
      this.writeToFile(entry);
    }
  }

  /**
   * Write to log file
   * @private
   */
  writeToFile(entry) {
    try {
      const logDir = this.config.paths?.logs;
      if (!logDir) return;

      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(logDir, `restricted-ide-${date}.log`);

      const line = JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.level,
        module: entry.module,
        message: entry.message,
      }) + '\n';

      fs.appendFileSync(logFile, line);

      // Check file size and rotate if needed
      this.rotateIfNeeded(logFile);
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write log:', error.message);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   * @private
   */
  rotateIfNeeded(logFile) {
    try {
      const stats = fs.statSync(logFile);
      const maxSize = this.config.logging?.maxFileSize || 10 * 1024 * 1024;

      if (stats.size > maxSize) {
        const rotatedFile = logFile.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(logFile, rotatedFile);
        this.cleanOldLogs();
      }
    } catch (error) {
      // Ignore rotation errors
    }
  }

  /**
   * Clean old log files
   * @private
   */
  cleanOldLogs() {
    try {
      const logDir = this.config.paths?.logs;
      if (!logDir) return;

      const maxFiles = this.config.logging?.maxFiles || 10;
      const files = fs.readdirSync(logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logDir, f),
          time: fs.statSync(path.join(logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      // Delete oldest files beyond max
      files.slice(maxFiles).forEach(f => {
        fs.unlinkSync(f.path);
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Log error message
   * @param {...any} args - Log arguments
   */
  error(...args) {
    this.log('error', ...args);
  }

  /**
   * Log warning message
   * @param {...any} args - Log arguments
   */
  warn(...args) {
    this.log('warn', ...args);
  }

  /**
   * Log info message
   * @param {...any} args - Log arguments
   */
  info(...args) {
    this.log('info', ...args);
  }

  /**
   * Log debug message
   * @param {...any} args - Log arguments
   */
  debug(...args) {
    this.log('debug', ...args);
  }

  /**
   * Log a security-related event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  security(event, data = {}) {
    const entry = {
      type: 'SECURITY',
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    this.warn('[SECURITY]', entry);
  }

  /**
   * Log an audit event
   * @param {string} action - Action name
   * @param {Object} details - Action details
   * @param {boolean} success - Whether action succeeded
   */
  audit(action, details = {}, success = true) {
    const entry = {
      type: 'AUDIT',
      action,
      details,
      success,
      timestamp: new Date().toISOString(),
    };
    this.info('[AUDIT]', entry);
  }
}

// Create a default logger instance
const defaultLogger = new Logger('App');

module.exports = { Logger, defaultLogger };
