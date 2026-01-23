/**
 * Time Rule - Validates access based on time restrictions
 * 
 * @module ide-core/policy/rules/TimeRule
 */

'use strict';

const { Logger } = require('../../utils/Logger');

const logger = new Logger('TimeRule');

/**
 * TimeRule - Time-based access validation
 */
class TimeRule {
  /**
   * @param {Object} config - Time policy configuration
   */
  constructor(config) {
    this.config = config || { enabled: false };
    this.enabled = this.config.enabled || false;
    this.schedule = this.config.schedule || null;
  }

  /**
   * Validate current time against policy
   * @returns {Object} Validation result
   */
  validate() {
    if (!this.enabled || !this.schedule) {
      return { allowed: true };
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Check day of week
    if (this.schedule.days && this.schedule.days.length > 0) {
      if (!this.schedule.days.includes(currentDay)) {
        return { 
          allowed: false, 
          reason: `Not available on this day (day ${currentDay})`
        };
      }
    }

    // Check time range
    if (this.schedule.startTime && this.schedule.endTime) {
      if (currentTime < this.schedule.startTime || currentTime > this.schedule.endTime) {
        return { 
          allowed: false, 
          reason: `Outside allowed time range (${this.schedule.startTime} - ${this.schedule.endTime})`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if currently within allowed time
   * @returns {boolean} Whether current time is allowed
   */
  isAllowed() {
    return this.validate().allowed;
  }

  /**
   * Get time remaining until end of session
   * @returns {number|null} Milliseconds remaining, or null if no limit
   */
  getTimeRemaining() {
    if (!this.enabled || !this.schedule || !this.schedule.endTime) {
      return null;
    }

    const now = new Date();
    const [endHour, endMinute] = this.schedule.endTime.split(':').map(Number);
    
    const endTime = new Date(now);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    const remaining = endTime.getTime() - now.getTime();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Set schedule
   * @param {Object} schedule - Schedule configuration
   */
  setSchedule(schedule) {
    this.schedule = schedule;
    logger.info('Schedule updated:', schedule);
  }

  /**
   * Enable time restrictions
   */
  enable() {
    this.enabled = true;
    logger.info('Time restrictions enabled');
  }

  /**
   * Disable time restrictions
   */
  disable() {
    this.enabled = false;
    logger.info('Time restrictions disabled');
  }

  /**
   * Get schedule
   * @returns {Object|null} Current schedule
   */
  getSchedule() {
    return this.schedule ? { ...this.schedule } : null;
  }

  /**
   * Check if time restrictions are enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = { TimeRule };
