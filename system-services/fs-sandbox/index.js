/**
 * File System Sandbox Module - JavaScript Interface
 * 
 * This module provides the JavaScript interface to the native
 * file system access control implementation.
 * 
 * @module system-services/fs-sandbox
 */

'use strict';

const path = require('path');
const fs = require('fs');

let nativeModule = null;

// Try to load native module
try {
  nativeModule = require('./build/Release/fs_sandbox.node');
} catch (error) {
  console.warn('Native fs-sandbox module not available, using stubs');
}

// Configuration
let config = {
  sandboxRoot: null,
  allowedExtensions: new Set(),
  maxFileSize: 10 * 1024 * 1024,
  deniedPaths: [],
};

/**
 * Configure the file system sandbox
 * @param {Object} options - Configuration options
 */
function configure(options) {
  if (nativeModule && nativeModule.configure) {
    return nativeModule.configure(options);
  }
  
  config.sandboxRoot = options.sandboxRoot || config.sandboxRoot;
  config.allowedExtensions = new Set(options.allowedExtensions || []);
  config.maxFileSize = options.maxFileSize || config.maxFileSize;
  
  // FIXED: Filter out bad paths before processing to prevent crash
  config.deniedPaths = (options.deniedPaths || [])
    .filter(p => p && typeof p === 'string')
    .map(p => p.toLowerCase());
  
  console.log('[STUB] configure called');
  console.log('[STUB] Sandbox root:', config.sandboxRoot);
  console.log('[STUB] Allowed extensions:', Array.from(config.allowedExtensions));
  
  return true;
}

/**
 * Initialize the sandbox
 */
function initialize() {
  if (nativeModule && nativeModule.initialize) {
    return nativeModule.initialize();
  }
  
  // Ensure sandbox directory exists
  if (config.sandboxRoot) {
    try {
      if (!fs.existsSync(config.sandboxRoot)) {
        fs.mkdirSync(config.sandboxRoot, { recursive: true });
        console.log('[STUB] Created sandbox directory:', config.sandboxRoot);
      }
    } catch (error) {
      console.error('[STUB] Failed to create sandbox directory:', error.message);
    }
  }
  
  console.log('[STUB] initialize called');
  return true;
}

/**
 * Shutdown the sandbox
 */
function shutdown() {
  if (nativeModule && nativeModule.shutdown) {
    return nativeModule.shutdown();
  }
  
  console.log('[STUB] shutdown called');
  return true;
}

/**
 * Validate a file path against sandbox rules
 * @param {string} filePath - Path to validate
 * @param {string} operation - Operation type (read, write, delete)
 * @returns {Object} Validation result
 */
function validatePath(filePath, operation = 'read') {
  if (nativeModule && nativeModule.validatePath) {
    return nativeModule.validatePath(filePath, operation);
  }
  
  // Stub implementation
  const normalizedPath = path.normalize(filePath).toLowerCase();
  
  // Check denied paths
  for (const denied of config.deniedPaths) {
    if (normalizedPath.startsWith(denied)) {
      return { allowed: false, reason: 'Path is denied' };
    }
  }
  
  // Check if within sandbox
  if (config.sandboxRoot) {
    const sandboxNormalized = path.normalize(config.sandboxRoot).toLowerCase();
    if (!normalizedPath.startsWith(sandboxNormalized)) {
      return { allowed: false, reason: 'Path outside sandbox' };
    }
  }
  
  // Check extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext && config.allowedExtensions.size > 0 && !config.allowedExtensions.has(ext)) {
    return { allowed: false, reason: 'Extension not allowed' };
  }
  
  return { allowed: true };
}

/**
 * Get sandbox root path
 * @returns {string|null}
 */
function getSandboxRoot() {
  return config.sandboxRoot;
}

/**
 * Check if native module is loaded
 * @returns {boolean}
 */
function isNativeLoaded() {
  return nativeModule !== null;
}

module.exports = {
  configure,
  initialize,
  shutdown,
  validatePath,
  getSandboxRoot,
  isNativeLoaded,
};
