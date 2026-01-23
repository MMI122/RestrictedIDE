/**
 * Input Control Module - JavaScript Interface
 * 
 * This module provides the JavaScript interface to the native
 * keyboard and mouse hook implementation.
 * 
 * In development mode, this provides stub implementations.
 * In production, it loads the native C++ addon.
 * 
 * @module system-services/input-control
 */

'use strict';

let nativeModule = null;

// Try to load native module
try {
  nativeModule = require('./build/Release/input_control.node');
} catch (error) {
  console.warn('Native input control module not available, using stubs');
}

/**
 * Initialize keyboard hook
 * @param {Function} callback - Callback for key events
 */
function initKeyboardHook(callback) {
  if (nativeModule && nativeModule.initKeyboardHook) {
    return nativeModule.initKeyboardHook(callback);
  }
  console.log('[STUB] initKeyboardHook called');
  return true;
}

/**
 * Stop keyboard hook
 */
function stopKeyboardHook() {
  if (nativeModule && nativeModule.stopKeyboardHook) {
    return nativeModule.stopKeyboardHook();
  }
  console.log('[STUB] stopKeyboardHook called');
  return true;
}

/**
 * Set blocked key combinations
 * @param {Array} combinations - Array of key combination arrays
 */
function setBlockedCombinations(combinations) {
  if (nativeModule && nativeModule.setBlockedCombinations) {
    return nativeModule.setBlockedCombinations(combinations);
  }
  console.log('[STUB] setBlockedCombinations called with', combinations.length, 'combinations');
  return true;
}

/**
 * Enable mouse restriction
 * @param {boolean} confineToWindow - Whether to confine mouse to window
 */
function enableMouseRestriction(confineToWindow) {
  if (nativeModule && nativeModule.enableMouseRestriction) {
    return nativeModule.enableMouseRestriction(confineToWindow);
  }
  console.log('[STUB] enableMouseRestriction called, confineToWindow:', confineToWindow);
  return true;
}

/**
 * Disable mouse restriction
 */
function disableMouseRestriction() {
  if (nativeModule && nativeModule.disableMouseRestriction) {
    return nativeModule.disableMouseRestriction();
  }
  console.log('[STUB] disableMouseRestriction called');
  return true;
}

/**
 * Check if native module is loaded
 * @returns {boolean}
 */
function isNativeLoaded() {
  return nativeModule !== null;
}

module.exports = {
  initKeyboardHook,
  stopKeyboardHook,
  setBlockedCombinations,
  enableMouseRestriction,
  disableMouseRestriction,
  isNativeLoaded,
};
