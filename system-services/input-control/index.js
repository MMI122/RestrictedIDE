/**
 * Input Control Module - Cross-Platform Implementation
 * Supports both Windows and macOS keyboard blocking
 */

'use strict';

// Detect platform
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

let nativeModule = null;
let registeredShortcuts = [];

// Try to load native module (for Windows native hooks)
try {
  nativeModule = require('./build/Release/input_control.node');
  console.log('[Native] Input control native module loaded');
} catch (error) {
  console.warn('[Native] Native input control module not available, using Electron shortcuts');
}

/**
 * Convert key array to Electron accelerator format
 */
function toElectronAccelerator(keys) {
  return keys.map(k => {
    k = k.toLowerCase();
    // Windows keys
    if (k === 'win') return isWindows ? 'Super' : 'Command';
    // Mac keys
    if (k === 'cmd' || k === 'command') return isMac ? 'Command' : 'Super';
    if (k === 'option') return 'Alt';
    // Common keys
    if (k === 'alt') return 'Alt';
    if (k === 'ctrl' || k === 'control') return 'Control';
    if (k === 'shift') return 'Shift';
    if (k === 'escape' || k === 'esc') return 'Escape';
    if (k === 'delete') return 'Delete';
    if (k === 'tab') return 'Tab';
    return k.toUpperCase();
  }).join('+');
}

/**
 * Initialize keyboard hook
 */
function initKeyboardHook(callback) {
  if (nativeModule && nativeModule.initKeyboardHook) {
    return nativeModule.initKeyboardHook(callback);
  }
  console.log(`[${isWindows ? 'Win' : 'Mac'}] Keyboard hook initialized (using Electron shortcuts)`);
  return true;
}

/**
 * Stop keyboard hook
 */
function stopKeyboardHook() {
  if (nativeModule && nativeModule.stopKeyboardHook) {
    return nativeModule.stopKeyboardHook();
  }
  
  // Unregister Electron global shortcuts
  try {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
    registeredShortcuts = [];
    console.log(`[${isWindows ? 'Win' : 'Mac'}] All keyboard shortcuts released`);
  } catch (error) {
    console.warn('Could not unregister shortcuts:', error.message);
  }
  return true;
}

/**
 * Set up menu hardening for macOS
 */
function setupMacMenuHardening() {
  if (!isMac) return;
  
  try {
    const { Menu } = require('electron');
    
    const template = [
      {
        label: 'RestrictedIDE',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          // REMOVED: { role: 'quit' } <--- Security: No quit option
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'togglefullscreen' }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    console.log('[Mac] Application menu hardened: "Quit" option removed');
  } catch (error) {
    console.warn('[Mac] Could not set up menu hardening:', error.message);
  }
}

/**
 * Set up menu hiding for Windows
 */
function setupWindowsMenuHiding() {
  if (!isWindows) return;
  
  try {
    const { Menu } = require('electron');
    Menu.setApplicationMenu(null);
    console.log('[Win] Application menu hidden');
  } catch (error) {
    console.warn('[Win] Could not hide menu:', error.message);
  }
}

/**
 * Set blocked key combinations
 */
function setBlockedCombinations(combinations) {
  // Use native module if available (Windows native hooks)
  if (nativeModule && nativeModule.setBlockedCombinations) {
    return nativeModule.setBlockedCombinations(combinations);
  }

  // Fallback: Use Electron globalShortcut
  try {
    const { globalShortcut } = require('electron');
    
    globalShortcut.unregisterAll();
    registeredShortcuts = [];
    
    // Set up platform-specific menu hardening
    if (isMac) {
      setupMacMenuHardening();
    } else {
      setupWindowsMenuHiding();
    }

    if (!Array.isArray(combinations)) return false;

    let blockCount = 0;

    combinations.forEach(item => {
      const keys = Array.isArray(item) ? item : (item.keys || []);
      if (keys.length === 0) return;

      const accelerator = toElectronAccelerator(keys);
      
      try {
        const success = globalShortcut.register(accelerator, () => {
          console.log(`[Security] 🚫 Blocked Key Combination: ${accelerator}`);
        });

        if (success) {
          registeredShortcuts.push(accelerator);
          blockCount++;
        } else {
          console.warn(`[${isWindows ? 'Win' : 'Mac'}] Failed to register: ${accelerator}`);
        }
      } catch (err) {
        console.error(`[${isWindows ? 'Win' : 'Mac'}] Error registering: ${accelerator}`, err.message);
      }
    });

    console.log(`[${isWindows ? 'Win' : 'Mac'}] Successfully blocked ${blockCount} key combinations`);
    return true;
  } catch (error) {
    console.error('Failed to set blocked combinations:', error.message);
    return false;
  }
}

/**
 * Enable mouse restriction
 */
function enableMouseRestriction(confineToWindow) {
  if (nativeModule && nativeModule.enableMouseRestriction) {
    return nativeModule.enableMouseRestriction(confineToWindow);
  }
  console.log(`[STUB] enableMouseRestriction called, confineToWindow: ${confineToWindow}`);
  return true;
}

/**
 * Disable mouse restriction
 */
function disableMouseRestriction() {
  if (nativeModule && nativeModule.disableMouseRestriction) {
    return nativeModule.disableMouseRestriction();
  }
  console.log('[STUB] disableMouseRestriction called');
  return true;
}

/**
 * Check if native module is loaded
 */
function isNativeLoaded() {
  return nativeModule !== null;
}

module.exports = {
  initKeyboardHook,
  stopKeyboardHook,
  setBlockedCombinations,
  enableMouseRestriction,
  disableMouseRestriction,
  isNativeLoaded,
};