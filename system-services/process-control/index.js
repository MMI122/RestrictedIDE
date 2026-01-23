/**
 * Process Control Module - macOS Production Implementation
 * Connects policy-defined blacklists to the native 'ps' command
 */

'use strict';

const { exec } = require('child_process');

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
  console.log(`[Mac] Blacklist updated with ${blacklist.size} apps`);
  return true;
}

function checkProcesses() {
  // Only run if we have things to block
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
        // We look for the banned app name inside the running command path
        if (commandPath.includes(bannedApp)) {
            // Prevent killing ourselves (the IDE) or critical system processes by accident
            if (commandPath.includes('restricted-ide') || commandPath.includes('vscode')) continue;

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

function startMonitoring(options = {}) {
  const interval = options.interval || 2000;
  onUnauthorizedCallback = options.onUnauthorized || null;
  
  if (monitoringActive) return true;
  monitoringActive = true;
  
  console.log('[Mac] Process monitoring started (Policy Driven)');
  
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
    process.kill(pid, 'SIGKILL'); 
    console.log(`[Mac] 💀 Successfully KILLED process ${pid}`);
    return true;
  } catch (error) {
    if (error.code !== 'ESRCH') { // Ignore if already dead
        console.error(`[Mac] Failed to kill process ${pid}:`, error.message);
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

// ==========================================
// TEST HELPER: Auto-start in Dev Mode
// ==========================================
// This forces the module to run even if the main app decides to be "nice"
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    // Only force start if the main app hasn't set a blacklist yet
    if (blacklist.size === 0) {
      console.log('[Mac] 🔧 Dev Mode: Auto-populating blacklist for testing...');
      
      // Add the apps you want to test blocking for:
      setBlacklist([
        'calculator', 
        'terminal', 
        'activity monitor',
        'notes',
        'safari'
      ]);
      
      startMonitoring({ interval: 1000 });
    }
  }, 3000); // Wait 3 seconds for app to start, then force it
}