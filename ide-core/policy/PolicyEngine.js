/**
 * Restricted IDE - Policy Engine
 * 
 * Central policy validation system that governs all user actions.
 * All actions must pass through this engine before execution.
 * 
 * @module ide-core/policy/PolicyEngine
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { Logger } = require('../utils/Logger');
const { UrlRule } = require('./rules/UrlRule');
const { KeyboardRule } = require('./rules/KeyboardRule');
const { ProcessRule } = require('./rules/ProcessRule');
const { FileAccessRule } = require('./rules/FileAccessRule');
const { TimeRule } = require('./rules/TimeRule');
const config = require('../config');

const logger = new Logger('PolicyEngine');

/**
 * PolicyEngine - Central policy validation
 * 
 * Design principles:
 * - All actions are denied by default
 * - Policies are explicit allow-lists
 * - All validations are logged
 * - Policies are modular and composable
 */
class PolicyEngine {
  constructor() {
    /** @type {Object} Current active policy */
    this.policy = null;
    
    /** @type {Map<string, Object>} Rule instances by type */
    this.rules = new Map();
    
    /** @type {Ajv} JSON schema validator */
    this.validator = new Ajv({ allErrors: true, strict: false });
    
    /** @type {boolean} Whether engine is initialized */
    this.initialized = false;
    
    /** @type {Array} Policy violation callbacks */
    this.violationCallbacks = [];
  }

  /**
   * Initialize the policy engine
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('Initializing policy engine...');
    
    // Load JSON schema for policy validation
    await this.loadSchema();
    
    // Load policies
    await this.loadPolicies();
    
    // Initialize rule handlers
    this.initializeRules();
    
    this.initialized = true;
    logger.info('Policy engine initialized');
  }

  /**
   * Load the policy JSON schema
   * @private
   */
  async loadSchema() {
    const schemaPath = path.join(__dirname, 'schemas', 'policy.schema.json');
    
    try {
      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const schema = JSON.parse(schemaContent);
        this.validatePolicy = this.validator.compile(schema);
        logger.debug('Policy schema loaded');
      } else {
        logger.warn('Policy schema not found, using permissive validation');
        this.validatePolicy = () => true;
      }
    } catch (error) {
      logger.error(`Failed to load policy schema: ${error.message}`);
      this.validatePolicy = () => true;
    }
  }

  /**
   * Load policies from files
   * @private
   */
  async loadPolicies() {
    // Load default policy first
    let defaultPolicy = this.getDefaultPolicy();
    
    try {
      if (fs.existsSync(config.policy.defaultPolicyPath)) {
        const content = fs.readFileSync(config.policy.defaultPolicyPath, 'utf8');
        defaultPolicy = { ...defaultPolicy, ...JSON.parse(content) };
        logger.info('Loaded default policy from file');
      }
    } catch (error) {
      logger.warn(`Failed to load default policy file: ${error.message}`);
    }
    
    // Load user policy (overrides default)
    let userPolicy = {};
    try {
      if (fs.existsSync(config.policy.userPolicyPath)) {
        const content = fs.readFileSync(config.policy.userPolicyPath, 'utf8');
        userPolicy = JSON.parse(content);
        logger.info('Loaded user policy from file');
      }
    } catch (error) {
      logger.warn(`Failed to load user policy file: ${error.message}`);
    }
    
    // Merge policies (user overrides default)
    this.policy = this.mergePolicies(defaultPolicy, userPolicy);
    
    // Validate merged policy
    if (config.policy.strictValidation && !this.validatePolicy(this.policy)) {
      logger.error('Policy validation failed:', this.validatePolicy.errors);
      throw new Error('Invalid policy configuration');
    }
    
    logger.info('Policies loaded successfully');
    logger.debug('Active policy:', JSON.stringify(this.policy, null, 2));
  }

  /**
   * Get default policy (fallback)
   * @private
   * @returns {Object} Default policy object
   */
  getDefaultPolicy() {
    return {
      version: '1.0.0',
      name: 'Default Restrictive Policy',
      description: 'Default policy that restricts most actions',
      
      urls: {
        mode: 'whitelist',
        patterns: [
          'https://developer.mozilla.org/*',
          'https://docs.python.org/*',
          'https://cplusplus.com/*',
          'https://www.w3schools.com/*',
        ],
      },
      
      keyboard: {
        mode: 'blacklist',
        blocked: [
          { keys: ['alt', 'tab'], reason: 'Window switching' },
          { keys: ['alt', 'f4'], reason: 'Close window' },
          { keys: ['ctrl', 'escape'], reason: 'Start menu' },
          { keys: ['win'], reason: 'Windows key' },
          { keys: ['ctrl', 'shift', 'escape'], reason: 'Task manager' },
          { keys: ['ctrl', 'alt', 'delete'], reason: 'Security options' },
        ],
      },
      
      processes: {
        mode: 'whitelist',
        allowed: [
          'restricted-ide.exe',
        ],
        blocked: [
          'cmd.exe',
          'powershell.exe',
          'taskmgr.exe',
          'explorer.exe',
        ],
      },
      
      fileAccess: {
        mode: 'sandbox',
        sandboxPath: config.fsSandbox.sandboxRoot,
        allowedExtensions: config.fsSandbox.allowedExtensions,
        maxFileSize: config.fsSandbox.maxFileSize,
        allowedPaths: [],
        deniedPaths: config.fsSandbox.deniedPaths,
      },
      
      time: {
        enabled: false,
        schedule: null,
      },
    };
  }

  /**
   * Merge two policies (deep merge)
   * @private
   * @param {Object} base - Base policy
   * @param {Object} override - Override policy
   * @returns {Object} Merged policy
   */
  mergePolicies(base, override) {
    const result = { ...base };
    
    for (const key of Object.keys(override)) {
      if (override[key] !== null && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergePolicies(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }
    
    return result;
  }

  /**
   * Initialize rule handlers
   * @private
   */
  initializeRules() {
    this.rules.set('url', new UrlRule(this.policy.urls));
    this.rules.set('keyboard', new KeyboardRule(this.policy.keyboard));
    this.rules.set('process', new ProcessRule(this.policy.processes));
    this.rules.set('fileAccess', new FileAccessRule(this.policy.fileAccess));
    this.rules.set('time', new TimeRule(this.policy.time));
    
    logger.debug('Rule handlers initialized');
  }

  /**
   * Validate a URL against policy
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is allowed
   */
  validateUrl(url) {
    const rule = this.rules.get('url');
    const result = rule.validate(url);
    
    this.logAction('URL_NAVIGATION', url, result);
    
    if (!result.allowed) {
      this.notifyViolation('url', url, result.reason);
    }
    
    return result.allowed;
  }

  /**
   * Validate a keyboard combination against policy
   * @param {string[]} keys - Array of key names
   * @returns {boolean} Whether key combination is allowed
   */
  validateKeyboard(keys) {
    const rule = this.rules.get('keyboard');
    const result = rule.validate(keys);
    
    this.logAction('KEYBOARD', keys.join('+'), result);
    
    if (!result.allowed) {
      this.notifyViolation('keyboard', keys, result.reason);
    }
    
    return result.allowed;
  }

  /**
   * Validate a process against policy
   * @param {string} processName - Process executable name
   * @returns {boolean} Whether process is allowed
   */
  validateProcess(processName) {
    const rule = this.rules.get('process');
    const result = rule.validate(processName);
    
    this.logAction('PROCESS', processName, result);
    
    if (!result.allowed) {
      this.notifyViolation('process', processName, result.reason);
    }
    
    return result.allowed;
  }

  /**
   * Validate file access against policy
   * @param {string} filePath - File path
   * @param {string} operation - Operation type (read, write, delete)
   * @returns {boolean} Whether access is allowed
   */
  validateFileAccess(filePath, operation = 'read') {
    const rule = this.rules.get('fileAccess');
    const result = rule.validate(filePath, operation);
    
    this.logAction('FILE_ACCESS', `${operation}: ${filePath}`, result);
    
    if (!result.allowed) {
      this.notifyViolation('fileAccess', { filePath, operation }, result.reason);
    }
    
    return result.allowed;
  }

  /**
   * Check if current time is within allowed schedule
   * @returns {boolean} Whether current time is allowed
   */
  validateTime() {
    const rule = this.rules.get('time');
    const result = rule.validate();
    
    if (!result.allowed) {
      this.logAction('TIME_RESTRICTION', new Date().toISOString(), result);
      this.notifyViolation('time', new Date(), result.reason);
    }
    
    return result.allowed;
  }

  /**
   * Generic action validation
   * @param {string} actionType - Type of action
   * @param {*} actionData - Action-specific data
   * @returns {Object} Validation result
   */
  validate(actionType, actionData) {
    const rule = this.rules.get(actionType);
    
    if (!rule) {
      logger.warn(`Unknown action type: ${actionType}`);
      return { allowed: false, reason: 'Unknown action type' };
    }
    
    const result = rule.validate(actionData);
    this.logAction(actionType.toUpperCase(), actionData, result);
    
    if (!result.allowed) {
      this.notifyViolation(actionType, actionData, result.reason);
    }
    
    return result;
  }

  /**
   * Log an action and its validation result
   * @private
   * @param {string} action - Action name
   * @param {*} data - Action data
   * @param {Object} result - Validation result
   */
  logAction(action, data, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      data: typeof data === 'object' ? JSON.stringify(data) : data,
      allowed: result.allowed,
      reason: result.reason || null,
    };
    
    if (result.allowed) {
      logger.debug(`Action allowed: ${action}`, data);
    } else {
      logger.warn(`Action blocked: ${action}`, data, result.reason);
    }
    
    // TODO: Write to audit log file
  }

  /**
   * Register a violation callback
   * @param {Function} callback - Callback function
   */
  onViolation(callback) {
    this.violationCallbacks.push(callback);
  }

  /**
   * Notify all violation callbacks
   * @private
   * @param {string} type - Violation type
   * @param {*} data - Violation data
   * @param {string} reason - Violation reason
   */
  notifyViolation(type, data, reason) {
    const violation = { type, data, reason, timestamp: Date.now() };
    
    for (const callback of this.violationCallbacks) {
      try {
        callback(violation);
      } catch (error) {
        logger.error('Violation callback error:', error);
      }
    }
  }

  /**
   * Update policy at runtime
   * @param {Object} newPolicy - New policy object
   * @returns {boolean} Whether update succeeded
   */
  updatePolicy(newPolicy) {
    // Validate new policy
    if (config.policy.strictValidation && !this.validatePolicy(newPolicy)) {
      logger.error('New policy validation failed:', this.validatePolicy.errors);
      return false;
    }
    
    // Merge with current policy
    this.policy = this.mergePolicies(this.policy, newPolicy);
    
    // Reinitialize rules
    this.initializeRules();
    
    // Save to user policy file
    try {
      const policyDir = path.dirname(config.policy.userPolicyPath);
      if (!fs.existsSync(policyDir)) {
        fs.mkdirSync(policyDir, { recursive: true });
      }
      fs.writeFileSync(config.policy.userPolicyPath, JSON.stringify(this.policy, null, 2));
      logger.info('Policy updated and saved');
    } catch (error) {
      logger.error(`Failed to save policy: ${error.message}`);
    }
    
    return true;
  }

  /**
   * Get current policy
   * @returns {Object} Current policy
   */
  getPolicy() {
    return { ...this.policy };
  }

  /**
   * Check if engine is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = { PolicyEngine };
