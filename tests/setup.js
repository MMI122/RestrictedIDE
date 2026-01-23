/**
 * Jest Test Setup
 * 
 * This file runs before each test suite.
 */

'use strict';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
// };

// Set test timeout
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  /**
   * Wait for a specified time
   * @param {number} ms - Milliseconds to wait
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a mock policy
   * @returns {Object} Mock policy object
   */
  createMockPolicy: () => ({
    version: '1.0.0',
    name: 'Test Policy',
    urls: {
      mode: 'whitelist',
      patterns: ['https://example.com/*'],
    },
    keyboard: {
      mode: 'blacklist',
      blocked: [{ keys: ['alt', 'tab'], reason: 'Test' }],
    },
    processes: {
      mode: 'whitelist',
      allowed: ['test.exe'],
      blocked: ['blocked.exe'],
    },
    fileAccess: {
      mode: 'sandbox',
      sandboxPath: '/tmp/test-sandbox',
      allowedExtensions: ['.txt', '.js'],
      maxFileSize: 1024 * 1024,
      deniedPaths: ['/etc'],
    },
    time: {
      enabled: false,
    },
  }),
};

// Cleanup after all tests
afterAll(() => {
  // Add any global cleanup here
});
