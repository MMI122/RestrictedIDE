/**
 * Process Control Module - Cross-Platform Implementation
 * Supports both Windows and macOS
 */

'use strict';

const { exec } = require('child_process');

// Detect platform
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Store for monitoring state
let monitoringActive = false;
let monitorInterval = null;
let whitelist = new Set();
let blacklist = new Set();
let onUnauthorizedCallback = null;

function setWhitelist(processes) {
  const validProcesses = (processes || []).filter(p => typeof p === 'string');
  whitelist = new Set(validProcesses.map(p => p.toLowerCase()));
  return true;
}

function setBlacklist(processes) {
  const validProcesses = (processes || []).filter(p => typeof p === 'string');
  blacklist = new Set(validProcesses.map(p => p.toLowerCase()));
  console.log(`[${isWindows ? 'Win' : 'Mac'}] Blacklist updated with ${blacklist.size} apps`);
  return true;
}

/**
 * Check running processes - Windows version
 */
function checkProcessesWindows() {
  if (blacklist.size === 0) return;

  // Windows: Use tasklist command
  exec('tasklist /FO CSV /NH', { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error || !stdout) return;

    const lines = stdout.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Parse CSV format: "process.exe","PID","Session Name","Session#","Mem Usage"
      const match = trimmed.match(/"([^"]+)","(\d+)"/);
      if (!match) return;

      const processName = match[1].toLowerCase();
      const pid = parseInt(match[2], 10);

      // Check against blacklist
      for (const bannedApp of blacklist) {
        if (processName.includes(bannedApp.toLowerCase())) {
          // Prevent killing ourselves or critical processes
          if (processName.includes('restricted-ide') || 
              processName.includes('electron') ||
              processName.includes('code')) continue;

          console.log(`[Security] 🚨 DETECTED BANNED APP: ${bannedApp.toUpperCase()} (PID: ${pid})`);
          
          killProcess(pid);

          if (onUnauthorizedCallback) {
            onUnauthorizedCallback({
              name: bannedApp,
              pid: pid,
              path: processName
            });
          }
        }
      }
    });
  });
}

/**
 * Check running processes - macOS version
 */
function checkProcessesMac() {
  if (blacklist.size === 0) return;

  exec('/bin/ps -A -o pid=,comm=', { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error || !stdout) return;

    const lines = stdout.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const firstSpace = trimmed.indexOf(' ');
      if (firstSpace === -1) return;

      const pid = parseInt(trimmed.substring(0, firstSpace), 10);
      const commandPath = trimmed.substring(firstSpace + 1).toLowerCase();

      // Check against blacklist
      for (const bannedApp of blacklist) {
        if (commandPath.includes(bannedApp)) {
          // Prevent killing ourselves or critical processes
          if (commandPath.includes('restricted-ide') || 
              commandPath.includes('vscode') ||
              commandPath.includes('electron')) continue;

          console.log(`[Security] 🚨 DETECTED BANNED APP: ${bannedApp.toUpperCase()} (PID: ${pid})`);
          
          killProcess(pid);

          if (onUnauthorizedCallback) {
            onUnauthorizedCallback({
              name: bannedApp,
              pid: pid,
              path: commandPath
            });
          }
        }
      }
    });
  });
}

/**
 * Check running processes - auto-selects based on platform
 */
function checkProcesses() {
  if (isWindows) {
    checkProcessesWindows();
  } else {
    checkProcessesMac();
  }
}

function startMonitoring(options = {}) {
  const interval = options.interval || 2000;
  onUnauthorizedCallback = options.onUnauthorized || null;
  
  if (monitoringActive) return true;
  monitoringActive = true;
  
  console.log(`[${isWindows ? 'Win' : 'Mac'}] Process monitoring started (Policy Driven)`);
  
  monitorInterval = setInterval(checkProcesses, interval);
  checkProcesses(); 
  return true;
}

function stopMonitoring() {
  monitoringActive = false;
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  return true;
}

function killProcess(pid) {
  try {
    if (isWindows) {
      // Windows: Use taskkill command
      exec(`taskkill /PID ${pid} /F`, (error) => {
        if (error) {
          console.error(`[Win] Failed to kill process ${pid}:`, error.message);
        } else {
          console.log(`[Win] 💀 Successfully KILLED process ${pid}`);
        }
      });
    } else {
      // macOS/Linux: Use process.kill
      process.kill(pid, 'SIGKILL'); 
      console.log(`[Mac] 💀 Successfully KILLED process ${pid}`);
    }
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`Failed to kill process ${pid}:`, error.message);
    }
    return false;
  }
}

// Stubs
function getRunningProcesses() { return []; }
function isNativeLoaded() { return false; }
function isMonitoring() { return monitoringActive; }

module.exports = {
  setWhitelist,
  setBlacklist,
  startMonitoring,
  stopMonitoring,
  killProcess,
  getRunningProcesses,
  isNativeLoaded,
  isMonitoring,
};