/**
 * Process Control Module - JavaScript Interface
 * 
 * This module provides the JavaScript interface to the native
 * process monitoring and control implementation.
 * 
 * @module system-services/process-control
 */

'use strict';

let nativeModule = null;

// Try to load native module
try {
  nativeModule = require('./build/Release/process_control.node');
} catch (error) {
  console.warn('Native process control module not available, using stubs');
}

// Store for monitoring state
let monitoringActive = false;
let monitorInterval = null;
let whitelist = new Set();
let blacklist = new Set();
let onUnauthorizedCallback = null;

/**
 * Set process whitelist
 * @param {string[]} processes - Array of allowed process names
 */
function setWhitelist(processes) {
  if (nativeModule && nativeModule.setWhitelist) {
    return nativeModule.setWhitelist(processes);
  }
  whitelist = new Set(processes.map(p => p.toLowerCase()));
  console.log('[STUB] setWhitelist called with', processes.length, 'processes');
  return true;
}

/**
 * Set process blacklist
 * @param {string[]} processes - Array of blocked process names
 */
function setBlacklist(processes) {
  if (nativeModule && nativeModule.setBlacklist) {
    return nativeModule.setBlacklist(processes);
  }
  blacklist = new Set(processes.map(p => p.toLowerCase()));
  console.log('[STUB] setBlacklist called with', processes.length, 'processes');
  return true;
}

/**
 * Start process monitoring
 * @param {Object} options - Monitoring options
 */
function startMonitoring(options = {}) {
  if (nativeModule && nativeModule.startMonitoring) {
    return nativeModule.startMonitoring(options);
  }
  
  const interval = options.interval || 1000;
  onUnauthorizedCallback = options.onUnauthorized || null;
  
  console.log('[STUB] startMonitoring called, interval:', interval);
  
  // Stub implementation using Node.js
  monitoringActive = true;
  
  // In a real implementation, this would use native code
  // For stub, we just log that monitoring started
  console.log('[STUB] Process monitoring started (stub mode - no actual monitoring)');
  
  return true;
}

/**
 * Stop process monitoring
 */
function stopMonitoring() {
  if (nativeModule && nativeModule.stopMonitoring) {
    return nativeModule.stopMonitoring();
  }
  
  monitoringActive = false;
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  
  console.log('[STUB] stopMonitoring called');
  return true;
}

/**
 * Kill a process by PID
 * @param {number} pid - Process ID
 */
function killProcess(pid) {
  if (nativeModule && nativeModule.killProcess) {
    return nativeModule.killProcess(pid);
  }
  
  console.log('[STUB] killProcess called for PID:', pid);
  
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch (error) {
    console.error('[STUB] Failed to kill process:', error.message);
    return false;
  }
}

/**
 * Get list of running processes
 * @returns {Array} Array of process info objects
 */
function getRunningProcesses() {
  if (nativeModule && nativeModule.getRunningProcesses) {
    return nativeModule.getRunningProcesses();
  }
  
  console.log('[STUB] getRunningProcesses called');
  // Return empty array in stub mode
  return [];
}

/**
 * Check if native module is loaded
 * @returns {boolean}
 */
function isNativeLoaded() {
  return nativeModule !== null;
}

/**
 * Check if monitoring is active
 * @returns {boolean}
 */
function isMonitoring() {
  return monitoringActive;
}

module.exports = {
  setWhitelist,
  setBlacklist,
  startMonitoring,
  stopMonitoring,
  killProcess,
  getRunningProcesses,
  isNativeLoaded,
  isMonitoring,
};
