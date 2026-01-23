/**
 * Keyboard Rule - Validates keyboard shortcuts against policy
 * 
 * @module ide-core/policy/rules/KeyboardRule
 */

'use strict';

const { Logger } = require('../../utils/Logger');

const logger = new Logger('KeyboardRule');

/**
 * KeyboardRule - Keyboard shortcut validation
 */
class KeyboardRule {
  /**
   * @param {Object} config - Keyboard policy configuration
   */
  constructor(config) {
    this.config = config || { mode: 'blacklist', blocked: [] };
    this.mode = this.config.mode || 'blacklist';
    this.blocked = this.normalizeKeyCombos(this.config.blocked || []);
    this.allowed = this.normalizeKeyCombos(this.config.allowed || []);
  }

  /**
   * Normalize key combination definitions
   * @private
   * @param {Array} combos - Key combination definitions
   * @returns {Map} Normalized key combinations
   */
  normalizeKeyCombos(combos) {
    const map = new Map();
    
    for (const combo of combos) {
      const keys = Array.isArray(combo) ? combo : combo.keys;
      const reason = combo.reason || 'Policy restriction';
      
      // Normalize key names and sort for consistent matching
      const normalized = keys.map(k => k.toLowerCase()).sort().join('+');
      map.set(normalized, { keys, reason });
    }
    
    return map;
  }

  /**
   * Validate a key combination against policy
   * @param {string[]} keys - Array of key names
   * @returns {Object} Validation result
   */
  validate(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return { allowed: true };
    }

    // Normalize input keys
    const normalized = keys.map(k => k.toLowerCase()).sort().join('+');

    if (this.mode === 'blacklist') {
      // Blacklist mode: Check if key combo is blocked
      const blockedEntry = this.blocked.get(normalized);
      
      if (blockedEntry) {
        return { 
          allowed: false, 
          reason: blockedEntry.reason || 'Key combination blocked'
        };
      }
      
      return { allowed: true };
    } else {
      // Whitelist mode: Check if key combo is explicitly allowed
      const allowedEntry = this.allowed.get(normalized);
      
      if (allowedEntry) {
        return { allowed: true };
      }
      
      return { 
        allowed: false, 
        reason: 'Key combination not in whitelist'
      };
    }
  }

  /**
   * Check if a specific key combination is blocked
   * @param {string[]} keys - Key combination
   * @returns {boolean} Whether combination is blocked
   */
  isBlocked(keys) {
    const normalized = keys.map(k => k.toLowerCase()).sort().join('+');
    return this.blocked.has(normalized);
  }

  /**
   * Add a blocked key combination
   * @param {string[]} keys - Key combination
   * @param {string} reason - Reason for blocking
   */
  addBlocked(keys, reason = 'Custom rule') {
    const normalized = keys.map(k => k.toLowerCase()).sort().join('+');
    this.blocked.set(normalized, { keys, reason });
    logger.info(`Added blocked key combo: ${keys.join('+')}`);
  }

  /**
   * Remove a blocked key combination
   * @param {string[]} keys - Key combination
   * @returns {boolean} Whether it was removed
   */
  removeBlocked(keys) {
    const normalized = keys.map(k => k.toLowerCase()).sort().join('+');
    const result = this.blocked.delete(normalized);
    if (result) {
      logger.info(`Removed blocked key combo: ${keys.join('+')}`);
    }
    return result;
  }

  /**
   * Get all blocked combinations
   * @returns {Array} Blocked combinations
   */
  getBlocked() {
    return Array.from(this.blocked.values());
  }
}

module.exports = { KeyboardRule };
