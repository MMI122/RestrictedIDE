/**
 * Process Rule - Validates process execution against policy
 * 
 * @module ide-core/policy/rules/ProcessRule
 */

'use strict';

const path = require('path');
const { Logger } = require('../../utils/Logger');

const logger = new Logger('ProcessRule');

/**
 * ProcessRule - Process execution validation
 */
class ProcessRule {
  /**
   * @param {Object} config - Process policy configuration
   */
  constructor(config) {
    this.config = config || { mode: 'whitelist', allowed: [], blocked: [] };
    this.mode = this.config.mode || 'whitelist';
    this.allowed = new Set((this.config.allowed || []).map(p => p.toLowerCase()));
    this.blocked = new Set((this.config.blocked || []).map(p => p.toLowerCase()));
    
    // System processes that should always be allowed
    this.systemProcesses = new Set([
      'system',
      'idle',
      'csrss.exe',
      'smss.exe',
      'services.exe',
      'lsass.exe',
      'svchost.exe',
      'conhost.exe',
      'dwm.exe',
      'winlogon.exe',
      'wininit.exe',
    ]);
  }

  /**
   * Validate a process against policy
   * @param {string} processName - Process name or path
   * @returns {Object} Validation result
   */
  validate(processName) {
    if (!processName || typeof processName !== 'string') {
      return { allowed: false, reason: 'Invalid process name' };
    }

    // Extract just the executable name
    const exeName = path.basename(processName).toLowerCase();

    // Always allow critical system processes
    if (this.systemProcesses.has(exeName)) {
      return { allowed: true, reason: 'System process' };
    }

    // Check explicit blocklist first (takes priority)
    if (this.blocked.has(exeName)) {
      return { 
        allowed: false, 
        reason: `Process explicitly blocked: ${exeName}`
      };
    }

    if (this.mode === 'whitelist') {
      // Whitelist mode: Process must be in allowed list
      if (this.allowed.has(exeName)) {
        return { allowed: true };
      } else {
        return { 
          allowed: false, 
          reason: `Process not in whitelist: ${exeName}`
        };
      }
    } else {
      // Blacklist mode: Process must not be in blocked list
      // Already checked blocked list above, so allow
      return { allowed: true };
    }
  }

  /**
   * Check if a process should be terminated
   * @param {string} processName - Process name
   * @returns {boolean} Whether process should be killed
   */
  shouldTerminate(processName) {
    const result = this.validate(processName);
    return !result.allowed;
  }

  /**
   * Add process to allowed list
   * @param {string} processName - Process name
   */
  addAllowed(processName) {
    this.allowed.add(processName.toLowerCase());
    logger.info(`Added allowed process: ${processName}`);
  }

  /**
   * Remove process from allowed list
   * @param {string} processName - Process name
   * @returns {boolean} Whether it was removed
   */
  removeAllowed(processName) {
    const result = this.allowed.delete(processName.toLowerCase());
    if (result) {
      logger.info(`Removed allowed process: ${processName}`);
    }
    return result;
  }

  /**
   * Add process to blocked list
   * @param {string} processName - Process name
   */
  addBlocked(processName) {
    this.blocked.add(processName.toLowerCase());
    logger.info(`Added blocked process: ${processName}`);
  }

  /**
   * Remove process from blocked list
   * @param {string} processName - Process name
   * @returns {boolean} Whether it was removed
   */
  removeBlocked(processName) {
    const result = this.blocked.delete(processName.toLowerCase());
    if (result) {
      logger.info(`Removed blocked process: ${processName}`);
    }
    return result;
  }

  /**
   * Get allowed processes
   * @returns {string[]} Allowed process names
   */
  getAllowed() {
    return Array.from(this.allowed);
  }

  /**
   * Get blocked processes
   * @returns {string[]} Blocked process names
   */
  getBlocked() {
    return Array.from(this.blocked);
  }
}

module.exports = { ProcessRule };
