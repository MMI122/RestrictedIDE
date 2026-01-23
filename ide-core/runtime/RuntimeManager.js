/**
 * Runtime Manager - Application lifecycle and state management
 * 
 * Manages application state, user sessions, and admin authentication.
 * 
 * @module ide-core/runtime/RuntimeManager
 */

'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { Logger } = require('../utils/Logger');
const config = require('../config');

const logger = new Logger('RuntimeManager');

/**
 * RuntimeManager - Application runtime management
 */
class RuntimeManager {
  /**
   * @param {PolicyEngine} policyEngine - Policy engine instance
   */
  constructor(policyEngine) {
    this.policyEngine = policyEngine;
    
    /** @type {Object} Current application state */
    this.state = {
      initialized: false,
      startTime: null,
      sessionId: null,
    };
    
    /** @type {Object} Admin session */
    this.adminSession = {
      authenticated: false,
      token: null,
      expiresAt: null,
      loginAttempts: 0,
      lockedUntil: null,
    };
    
    /** @type {boolean} Admin exit requested */
    this.adminExitRequested = false;
    
    /** @type {string} Admin password hash path */
    this.adminHashPath = path.join(config.paths.config, 'admin.hash');
  }

  /**
   * Initialize the runtime manager
   */
  initialize() {
    logger.info('Initializing runtime manager...');
    
    this.state.initialized = true;
    this.state.startTime = Date.now();
    this.state.sessionId = uuidv4();
    
    // Ensure admin password is set
    this.ensureAdminPassword();
    
    // Start session timer if time rules are enabled
    this.startTimeMonitor();
    
    logger.info(`Session started: ${this.state.sessionId}`);
  }

  /**
   * Ensure admin password exists, create default if not
   * @private
   */
  async ensureAdminPassword() {
    try {
      if (!fs.existsSync(this.adminHashPath)) {
        // Create default admin password
        // IMPORTANT: This should be changed on first login
        const defaultPassword = 'admin123!';
        const hash = await bcrypt.hash(defaultPassword, 12);
        
        const dir = path.dirname(this.adminHashPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(this.adminHashPath, hash);
        logger.warn('Default admin password created. Please change immediately!');
        logger.warn('Default password: admin123!');
      }
    } catch (error) {
      logger.error('Failed to ensure admin password:', error.message);
    }
  }

  /**
   * Authenticate admin user
   * @param {string} password - Admin password
   * @returns {Object} Authentication result
   */
  async authenticateAdmin(password) {
    logger.info('Admin authentication attempt...');

    // Check lockout
    if (this.adminSession.lockedUntil && Date.now() < this.adminSession.lockedUntil) {
      const remaining = Math.ceil((this.adminSession.lockedUntil - Date.now()) / 1000);
      logger.warn(`Admin login locked for ${remaining} seconds`);
      return { 
        success: false, 
        error: `Account locked. Try again in ${remaining} seconds.`
      };
    }

    try {
      // Read stored hash
      const storedHash = fs.readFileSync(this.adminHashPath, 'utf8').trim();
      
      // Verify password
      const isValid = await bcrypt.compare(password, storedHash);
      
      if (isValid) {
        // Successful login
        this.adminSession.authenticated = true;
        this.adminSession.token = uuidv4();
        this.adminSession.expiresAt = Date.now() + config.admin.sessionTimeout;
        this.adminSession.loginAttempts = 0;
        this.adminSession.lockedUntil = null;
        
        logger.security('ADMIN_LOGIN_SUCCESS');
        logger.audit('ADMIN_LOGIN', { success: true });
        
        // Start session timeout
        this.startAdminSessionTimeout();
        
        return { 
          success: true, 
          token: this.adminSession.token,
          expiresAt: this.adminSession.expiresAt,
        };
      } else {
        // Failed login
        this.adminSession.loginAttempts++;
        
        logger.security('ADMIN_LOGIN_FAILED', { 
          attempts: this.adminSession.loginAttempts 
        });
        
        // Check lockout threshold
        if (this.adminSession.loginAttempts >= config.admin.maxLoginAttempts) {
          this.adminSession.lockedUntil = Date.now() + config.admin.lockoutDuration;
          logger.security('ADMIN_ACCOUNT_LOCKED');
          return { 
            success: false, 
            error: 'Too many failed attempts. Account locked.'
          };
        }
        
        return { 
          success: false, 
          error: 'Invalid password',
          attemptsRemaining: config.admin.maxLoginAttempts - this.adminSession.loginAttempts,
        };
      }
    } catch (error) {
      logger.error('Admin authentication error:', error.message);
      return { success: false, error: 'Authentication error' };
    }
  }

  /**
   * Start admin session timeout
   * @private
   */
  startAdminSessionTimeout() {
    if (this.adminSessionTimer) {
      clearTimeout(this.adminSessionTimer);
    }
    
    this.adminSessionTimer = setTimeout(() => {
      this.logoutAdmin();
      logger.info('Admin session expired');
    }, config.admin.sessionTimeout);
  }

  /**
   * Log out admin user
   * @returns {boolean} Success
   */
  logoutAdmin() {
    this.adminSession.authenticated = false;
    this.adminSession.token = null;
    this.adminSession.expiresAt = null;
    
    if (this.adminSessionTimer) {
      clearTimeout(this.adminSessionTimer);
      this.adminSessionTimer = null;
    }
    
    logger.security('ADMIN_LOGOUT');
    logger.audit('ADMIN_LOGOUT', { success: true });
    
    return true;
  }

  /**
   * Check if admin is authenticated
   * @returns {boolean}
   */
  isAdminAuthenticated() {
    if (!this.adminSession.authenticated) {
      return false;
    }
    
    // Check expiration
    if (this.adminSession.expiresAt && Date.now() > this.adminSession.expiresAt) {
      this.logoutAdmin();
      return false;
    }
    
    return true;
  }

  /**
   * Validate admin token
   * @param {string} token - Admin token
   * @returns {boolean} Whether token is valid
   */
  validateAdminToken(token) {
    return this.isAdminAuthenticated() && this.adminSession.token === token;
  }

  /**
   * Change admin password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Object} Result
   */
  async changeAdminPassword(currentPassword, newPassword) {
    // Verify current password
    const authResult = await this.authenticateAdmin(currentPassword);
    if (!authResult.success) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password
    const validation = this.validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // Hash new password
      const hash = await bcrypt.hash(newPassword, 12);
      fs.writeFileSync(this.adminHashPath, hash);
      
      logger.security('ADMIN_PASSWORD_CHANGED');
      logger.audit('ADMIN_PASSWORD_CHANGE', { success: true });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to change password:', error.message);
      return { success: false, error: 'Failed to save new password' };
    }
  }

  /**
   * Validate password against requirements
   * @private
   */
  validatePassword(password) {
    const { 
      passwordMinLength, 
      passwordRequireUppercase,
      passwordRequireLowercase,
      passwordRequireNumber,
      passwordRequireSpecial,
    } = config.admin;

    if (password.length < passwordMinLength) {
      return { valid: false, error: `Password must be at least ${passwordMinLength} characters` };
    }

    if (passwordRequireUppercase && !/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain uppercase letter' };
    }

    if (passwordRequireLowercase && !/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain lowercase letter' };
    }

    if (passwordRequireNumber && !/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain a number' };
    }

    if (passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valid: false, error: 'Password must contain a special character' };
    }

    return { valid: true };
  }

  /**
   * Request admin exit (from kiosk mode)
   * @returns {boolean} Success
   */
  requestAdminExit() {
    if (!this.isAdminAuthenticated()) {
      logger.warn('Exit requested without admin authentication');
      return false;
    }
    
    this.adminExitRequested = true;
    logger.security('ADMIN_EXIT_REQUESTED');
    logger.audit('KIOSK_EXIT', { admin: true });
    
    return true;
  }

  /**
   * Check if admin exit was requested
   * @returns {boolean}
   */
  isAdminExitRequested() {
    return this.adminExitRequested;
  }

  /**
   * Start time-based access monitoring
   * @private
   */
  startTimeMonitor() {
    // Check time rules every minute
    this.timeMonitorInterval = setInterval(() => {
      if (this.policyEngine) {
        const timeAllowed = this.policyEngine.validateTime();
        if (!timeAllowed) {
          logger.security('TIME_RESTRICTION_TRIGGERED');
          // TODO: Notify renderer about time restriction
        }
      }
    }, 60000);
  }

  /**
   * Get current runtime state
   * @returns {Object} Runtime state
   */
  getState() {
    return {
      ...this.state,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
      adminAuthenticated: this.isAdminAuthenticated(),
    };
  }

  /**
   * Get current session info
   * @returns {Object} Session info
   */
  getSession() {
    return {
      id: this.state.sessionId,
      startTime: this.state.startTime,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.timeMonitorInterval) {
      clearInterval(this.timeMonitorInterval);
    }
    if (this.adminSessionTimer) {
      clearTimeout(this.adminSessionTimer);
    }
    
    logger.info('Runtime manager cleanup complete');
  }
}

module.exports = { RuntimeManager };
