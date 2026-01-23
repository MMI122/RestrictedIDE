/**
 * File Access Rule - Validates file system access against policy
 * 
 * @module ide-core/policy/rules/FileAccessRule
 */

'use strict';

const path = require('path');
const { Logger } = require('../../utils/Logger');

const logger = new Logger('FileAccessRule');

/**
 * FileAccessRule - File system access validation
 */
class FileAccessRule {
  /**
   * @param {Object} config - File access policy configuration
   */
  constructor(config) {
    this.config = config || { mode: 'sandbox' };
    this.mode = this.config.mode || 'sandbox';
    this.sandboxPath = this.config.sandboxPath || '';
    this.allowedExtensions = new Set(
      (this.config.allowedExtensions || []).map(ext => ext.toLowerCase())
    );
    this.maxFileSize = this.config.maxFileSize || 10 * 1024 * 1024; // 10 MB default
    this.allowedPaths = (this.config.allowedPaths || []).map(p => 
      path.normalize(p).toLowerCase()
    );
    this.deniedPaths = (this.config.deniedPaths || []).map(p => 
      path.normalize(p).toLowerCase()
    );
  }

  /**
   * Validate file access against policy
   * @param {string} filePath - File path
   * @param {string} operation - Operation type (read, write, delete)
   * @returns {Object} Validation result
   */
  validate(filePath, operation = 'read') {
    if (!filePath || typeof filePath !== 'string') {
      return { allowed: false, reason: 'Invalid file path' };
    }

    // Normalize the path
    const normalizedPath = path.normalize(filePath).toLowerCase();
    const absolutePath = path.isAbsolute(filePath) 
      ? normalizedPath 
      : path.join(process.cwd(), normalizedPath);

    // Check for path traversal attempts
    if (filePath.includes('..')) {
      logger.warn(`Path traversal attempt detected: ${filePath}`);
      return { allowed: false, reason: 'Path traversal not allowed' };
    }

    // Check denied paths first
    for (const denied of this.deniedPaths) {
      if (absolutePath.startsWith(denied)) {
        return { 
          allowed: false, 
          reason: `Access denied to path: ${denied}`
        };
      }
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext && this.allowedExtensions.size > 0 && !this.allowedExtensions.has(ext)) {
      return { 
        allowed: false, 
        reason: `File extension not allowed: ${ext}`
      };
    }

    // Mode-specific validation
    if (this.mode === 'sandbox') {
      return this.validateSandbox(absolutePath, operation);
    } else if (this.mode === 'whitelist') {
      return this.validateWhitelist(absolutePath, operation);
    } else {
      // Blacklist mode - denied paths already checked
      return { allowed: true };
    }
  }

  /**
   * Validate against sandbox restrictions
   * @private
   */
  validateSandbox(absolutePath, operation) {
    if (!this.sandboxPath) {
      return { allowed: false, reason: 'Sandbox path not configured' };
    }

    const normalizedSandbox = path.normalize(this.sandboxPath).toLowerCase();

    // Path must be within sandbox
    if (!absolutePath.startsWith(normalizedSandbox)) {
      // Check if path is in explicitly allowed paths
      const isAllowed = this.allowedPaths.some(ap => 
        absolutePath.startsWith(ap)
      );
      
      if (!isAllowed) {
        return { 
          allowed: false, 
          reason: 'Path outside sandbox'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate against whitelist
   * @private
   */
  validateWhitelist(absolutePath, operation) {
    const isAllowed = this.allowedPaths.some(ap => 
      absolutePath.startsWith(ap)
    );

    if (isAllowed) {
      return { allowed: true };
    }

    return { 
      allowed: false, 
      reason: 'Path not in whitelist'
    };
  }

  /**
   * Check file size limit
   * @param {number} size - File size in bytes
   * @returns {Object} Validation result
   */
  validateFileSize(size) {
    if (size > this.maxFileSize) {
      return { 
        allowed: false, 
        reason: `File size exceeds limit: ${size} > ${this.maxFileSize}`
      };
    }
    return { allowed: true };
  }

  /**
   * Get sandbox path
   * @returns {string} Sandbox path
   */
  getSandboxPath() {
    return this.sandboxPath;
  }

  /**
   * Set sandbox path
   * @param {string} sandboxPath - New sandbox path
   */
  setSandboxPath(sandboxPath) {
    this.sandboxPath = sandboxPath;
    logger.info(`Sandbox path updated: ${sandboxPath}`);
  }

  /**
   * Add allowed extension
   * @param {string} extension - File extension
   */
  addAllowedExtension(extension) {
    const ext = extension.toLowerCase();
    if (!ext.startsWith('.')) {
      this.allowedExtensions.add('.' + ext);
    } else {
      this.allowedExtensions.add(ext);
    }
    logger.info(`Added allowed extension: ${extension}`);
  }

  /**
   * Remove allowed extension
   * @param {string} extension - File extension
   * @returns {boolean} Whether it was removed
   */
  removeAllowedExtension(extension) {
    const ext = extension.toLowerCase();
    const result = this.allowedExtensions.delete(ext) || 
                   this.allowedExtensions.delete('.' + ext);
    if (result) {
      logger.info(`Removed allowed extension: ${extension}`);
    }
    return result;
  }

  /**
   * Add allowed path
   * @param {string} pathToAdd - Path to allow
   */
  addAllowedPath(pathToAdd) {
    const normalized = path.normalize(pathToAdd).toLowerCase();
    if (!this.allowedPaths.includes(normalized)) {
      this.allowedPaths.push(normalized);
      logger.info(`Added allowed path: ${pathToAdd}`);
    }
  }

  /**
   * Add denied path
   * @param {string} pathToDeny - Path to deny
   */
  addDeniedPath(pathToDeny) {
    const normalized = path.normalize(pathToDeny).toLowerCase();
    if (!this.deniedPaths.includes(normalized)) {
      this.deniedPaths.push(normalized);
      logger.info(`Added denied path: ${pathToDeny}`);
    }
  }

  /**
   * Get allowed extensions
   * @returns {string[]} Allowed extensions
   */
  getAllowedExtensions() {
    return Array.from(this.allowedExtensions);
  }

  /**
   * Get allowed paths
   * @returns {string[]} Allowed paths
   */
  getAllowedPaths() {
    return [...this.allowedPaths];
  }

  /**
   * Get denied paths
   * @returns {string[]} Denied paths
   */
  getDeniedPaths() {
    return [...this.deniedPaths];
  }
}

module.exports = { FileAccessRule };
