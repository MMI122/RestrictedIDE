/**
 * Build Verification Script
 * 
 * Verifies that all components are properly installed and configured.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, message) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}: ${message}`);
    failed++;
  }
  checks.push({ name, passed: condition, message });
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function dirExists(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

console.log('Restricted IDE - Build Verification\n');
console.log('='.repeat(50));
console.log('');

// Check core files
console.log('Core Files:');
check('package.json exists', fileExists('package.json'), 'Missing package.json');
check('Main entry point', fileExists('ide-core/main.js'), 'Missing ide-core/main.js');
check('Config file', fileExists('ide-core/config.js'), 'Missing ide-core/config.js');
check('Preload script', fileExists('ide-ui/preload.js'), 'Missing ide-ui/preload.js');
check('Main HTML', fileExists('ide-ui/index.html'), 'Missing ide-ui/index.html');
check('Renderer script', fileExists('ide-ui/renderer.js'), 'Missing ide-ui/renderer.js');

console.log('');
console.log('Policy Engine:');
check('PolicyEngine', fileExists('ide-core/policy/PolicyEngine.js'), 'Missing PolicyEngine');
check('Policy schema', fileExists('ide-core/policy/schemas/policy.schema.json'), 'Missing schema');
check('UrlRule', fileExists('ide-core/policy/rules/UrlRule.js'), 'Missing UrlRule');
check('KeyboardRule', fileExists('ide-core/policy/rules/KeyboardRule.js'), 'Missing KeyboardRule');
check('ProcessRule', fileExists('ide-core/policy/rules/ProcessRule.js'), 'Missing ProcessRule');
check('FileAccessRule', fileExists('ide-core/policy/rules/FileAccessRule.js'), 'Missing FileAccessRule');
check('TimeRule', fileExists('ide-core/policy/rules/TimeRule.js'), 'Missing TimeRule');

console.log('');
console.log('IPC & Runtime:');
check('IpcMain', fileExists('ide-core/ipc/IpcMain.js'), 'Missing IpcMain');
check('IpcChannels', fileExists('ide-core/ipc/IpcChannels.js'), 'Missing IpcChannels');
check('RuntimeManager', fileExists('ide-core/runtime/RuntimeManager.js'), 'Missing RuntimeManager');
check('SystemServiceManager', fileExists('ide-core/runtime/SystemServiceManager.js'), 'Missing SystemServiceManager');

console.log('');
console.log('Utilities:');
check('Logger', fileExists('ide-core/utils/Logger.js'), 'Missing Logger');

console.log('');
console.log('System Services:');
check('input-control index', fileExists('system-services/input-control/index.js'), 'Missing input-control');
check('input-control binding.gyp', fileExists('system-services/input-control/binding.gyp'), 'Missing binding.gyp');
check('process-control index', fileExists('system-services/process-control/index.js'), 'Missing process-control');
check('process-control binding.gyp', fileExists('system-services/process-control/binding.gyp'), 'Missing binding.gyp');
check('fs-sandbox index', fileExists('system-services/fs-sandbox/index.js'), 'Missing fs-sandbox');
check('fs-sandbox binding.gyp', fileExists('system-services/fs-sandbox/binding.gyp'), 'Missing binding.gyp');

console.log('');
console.log('Configuration:');
check('Default policy', fileExists('installer/config/default-policy.json'), 'Missing default policy');
check('Kiosk settings', fileExists('installer/config/kiosk-settings.json'), 'Missing kiosk settings');

console.log('');
console.log('Documentation:');
check('README', fileExists('README.md'), 'Missing README');
check('SRS document', fileExists('docs/SRS.md'), 'Missing SRS');

console.log('');
console.log('Directories:');
check('ide-ui directory', dirExists('ide-ui'), 'Missing ide-ui directory');
check('ide-core directory', dirExists('ide-core'), 'Missing ide-core directory');
check('system-services directory', dirExists('system-services'), 'Missing system-services directory');
check('installer directory', dirExists('installer'), 'Missing installer directory');
check('docs directory', dirExists('docs'), 'Missing docs directory');
check('tests directory', dirExists('tests'), 'Missing tests directory');
check('logs directory', dirExists('logs'), 'Missing logs directory');

// Check node_modules
console.log('');
console.log('Dependencies:');
const hasNodeModules = dirExists('node_modules');
check('node_modules installed', hasNodeModules, 'Run "npm install" to install dependencies');

if (hasNodeModules) {
  check('electron', dirExists('node_modules/electron'), 'Missing electron');
  check('winston', dirExists('node_modules/winston'), 'Missing winston');
  check('bcrypt', dirExists('node_modules/bcrypt'), 'Missing bcrypt');
  check('ajv', dirExists('node_modules/ajv'), 'Missing ajv');
}

// Summary
console.log('');
console.log('='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('Some checks failed. Please review the issues above.');
  process.exit(1);
} else {
  console.log('All checks passed! The project is ready for development.');
  process.exit(0);
}
