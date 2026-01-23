/**
 * URL Rule - Validates URL access against policy
 * 
 * @module ide-core/policy/rules/UrlRule
 */

'use strict';

const { Logger } = require('../../utils/Logger');

const logger = new Logger('UrlRule');

/**
 * UrlRule - URL validation rule
 */
class UrlRule {
  /**
   * @param {Object} config - URL policy configuration
   */
  constructor(config) {
    this.config = config || { mode: 'whitelist', patterns: [] };
    this.mode = this.config.mode || 'whitelist';
    this.patterns = this.compilePatterns(this.config.patterns || []);
  }

  /**
   * Compile glob patterns to RegExp
   * @private
   * @param {string[]} patterns - Glob patterns
   * @returns {RegExp[]} Compiled patterns
   */
  compilePatterns(patterns) {
    return patterns.map(pattern => {
      // If already a regex (starts with ^), use as-is
      if (pattern.startsWith('^')) {
        return new RegExp(pattern);
      }
      
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
        .replace(/\*/g, '.*'); // Convert * to .*
      
      return new RegExp(`^${regexPattern}$`, 'i');
    });
  }

  /**
   * Validate a URL against policy
   * @param {string} url - URL to validate
   * @returns {Object} Validation result
   */
  validate(url) {
    if (!url || typeof url !== 'string') {
      return { allowed: false, reason: 'Invalid URL' };
    }

    // Normalize URL
    let normalizedUrl;
    try {
      normalizedUrl = new URL(url);
    } catch (error) {
      return { allowed: false, reason: 'Malformed URL' };
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(normalizedUrl.protocol)) {
      return { allowed: false, reason: `Protocol not allowed: ${normalizedUrl.protocol}` };
    }

    // Check against patterns
    const matches = this.patterns.some(pattern => pattern.test(url));

    if (this.mode === 'whitelist') {
      // Whitelist mode: URL must match at least one pattern
      if (matches) {
        return { allowed: true };
      } else {
        return { allowed: false, reason: 'URL not in whitelist' };
      }
    } else {
      // Blacklist mode: URL must not match any pattern
      if (matches) {
        return { allowed: false, reason: 'URL is blacklisted' };
      } else {
        return { allowed: true };
      }
    }
  }

  /**
   * Add a pattern to the rule
   * @param {string} pattern - Pattern to add
   */
  addPattern(pattern) {
    this.config.patterns.push(pattern);
    this.patterns.push(this.compilePatterns([pattern])[0]);
    logger.info(`Added URL pattern: ${pattern}`);
  }

  /**
   * Remove a pattern from the rule
   * @param {string} pattern - Pattern to remove
   * @returns {boolean} Whether pattern was removed
   */
  removePattern(pattern) {
    const index = this.config.patterns.indexOf(pattern);
    if (index !== -1) {
      this.config.patterns.splice(index, 1);
      this.patterns = this.compilePatterns(this.config.patterns);
      logger.info(`Removed URL pattern: ${pattern}`);
      return true;
    }
    return false;
  }

  /**
   * Get current patterns
   * @returns {string[]} Current patterns
   */
  getPatterns() {
    return [...this.config.patterns];
  }
}

module.exports = { UrlRule };
