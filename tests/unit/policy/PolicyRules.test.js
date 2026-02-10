/**
 * Policy Engine Unit Tests
 */

'use strict';

// Mock dependencies
jest.mock('fs');
jest.mock('../../../ide-core/utils/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

const { UrlRule } = require('../../../ide-core/policy/rules/UrlRule');
const { KeyboardRule } = require('../../../ide-core/policy/rules/KeyboardRule');
const { ProcessRule } = require('../../../ide-core/policy/rules/ProcessRule');
const { FileAccessRule } = require('../../../ide-core/policy/rules/FileAccessRule');
const { TimeRule } = require('../../../ide-core/policy/rules/TimeRule');

describe('UrlRule', () => {
  describe('whitelist mode', () => {
    const rule = new UrlRule({
      mode: 'whitelist',
      patterns: [
        'https://example.com/*',
        'https://docs.test.org/*',
      ],
    });

    test('allows URLs matching whitelist', () => {
      const result = rule.validate('https://example.com/page');
      expect(result.allowed).toBe(true);
    });

    test('blocks URLs not in whitelist', () => {
      const result = rule.validate('https://blocked.com/page');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('URL not in whitelist');
    });

    test('blocks invalid URLs', () => {
      const result = rule.validate('not-a-url');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Malformed URL');
    });

    test('blocks non-http protocols', () => {
      const result = rule.validate('file:///etc/passwd');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Protocol not allowed');
    });
  });

  describe('blacklist mode', () => {
    const rule = new UrlRule({
      mode: 'blacklist',
      patterns: ['https://blocked.com/*'],
    });

    test('allows URLs not in blacklist', () => {
      const result = rule.validate('https://example.com/page');
      expect(result.allowed).toBe(true);
    });

    test('blocks URLs in blacklist', () => {
      const result = rule.validate('https://blocked.com/page');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('URL is blacklisted');
    });
  });
});

describe('KeyboardRule', () => {
  const rule = new KeyboardRule({
    mode: 'blacklist',
    blocked: [
      { keys: ['alt', 'tab'], reason: 'Window switching disabled' },
      { keys: ['ctrl', 'alt', 'delete'], reason: 'Security options disabled' },
    ],
  });

  test('blocks Alt+Tab', () => {
    const result = rule.validate(['alt', 'tab']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Window switching disabled');
  });

  test('blocks Ctrl+Alt+Delete regardless of order', () => {
    const result = rule.validate(['delete', 'ctrl', 'alt']);
    expect(result.allowed).toBe(false);
  });

  test('allows unblocked combinations', () => {
    const result = rule.validate(['ctrl', 's']);
    expect(result.allowed).toBe(true);
  });

  test('allows empty key array', () => {
    const result = rule.validate([]);
    expect(result.allowed).toBe(true);
  });
});

describe('ProcessRule', () => {
  const rule = new ProcessRule({
    mode: 'whitelist',
    allowed: ['allowed.exe', 'test.exe'],
    blocked: ['dangerous.exe'],
  });

  test('allows whitelisted processes', () => {
    const result = rule.validate('allowed.exe');
    expect(result.allowed).toBe(true);
  });

  test('blocks non-whitelisted processes', () => {
    const result = rule.validate('unknown.exe');
    expect(result.allowed).toBe(false);
  });

  test('blocks explicitly blacklisted processes', () => {
    const result = rule.validate('dangerous.exe');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('explicitly blocked');
  });

  test('allows system processes', () => {
    const result = rule.validate('csrss.exe');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('System process');
  });

  test('handles full paths', () => {
    const result = rule.validate('C:\\Program Files\\allowed.exe');
    expect(result.allowed).toBe(true);
  });
});

describe('FileAccessRule', () => {
  const rule = new FileAccessRule({
    mode: 'sandbox',
    sandboxPath: 'C:\\sandbox',
    allowedExtensions: ['.txt', '.js'],
    maxFileSize: 1024 * 1024,
    deniedPaths: ['C:\\Windows'],
  });

  test('allows files within sandbox', () => {
    const result = rule.validate('C:\\sandbox\\test.txt', 'read');
    expect(result.allowed).toBe(true);
  });

  test('blocks files outside sandbox', () => {
    const result = rule.validate('C:\\other\\test.txt', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Path outside sandbox');
  });

  test('blocks denied paths', () => {
    const result = rule.validate('C:\\Windows\\system32\\config', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Access denied');
  });

  test('blocks disallowed extensions', () => {
    const result = rule.validate('C:\\sandbox\\test.exe', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('extension not allowed');
  });

  test('blocks path traversal attempts', () => {
    const result = rule.validate('C:\\sandbox\\..\\Windows\\system.ini', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Path traversal not allowed');
  });
});

describe('TimeRule', () => {
  test('allows access when disabled', () => {
    const rule = new TimeRule({ enabled: false });
    const result = rule.validate();
    expect(result.allowed).toBe(true);
  });

  test('allows access within schedule', () => {
    const now = new Date();
    const startHour = (now.getHours() - 1 + 24) % 24;
    const endHour = (now.getHours() + 1) % 24;
    
    const rule = new TimeRule({
      enabled: true,
      schedule: {
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(endHour).padStart(2, '0')}:00`,
        days: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    
    const result = rule.validate();
    expect(result.allowed).toBe(true);
  });
});
