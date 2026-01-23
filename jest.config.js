module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
  ],
  collectCoverageFrom: [
    'ide-core/**/*.js',
    'ide-ui/**/*.js',
    '!**/node_modules/**',
    '!**/build/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  setupFilesAfterEnv: ['./tests/setup.js'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/ide-core/$1',
    '^@ui/(.*)$': '<rootDir>/ide-ui/$1',
    '^@services/(.*)$': '<rootDir>/system-services/$1',
  },
};
