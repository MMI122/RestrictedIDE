/**
 * Input Control Module - macOS "Hardened Menu" Version
 * Removes native 'Quit' menu items to ensure blocking works.
 */

'use strict';

// ADDED: Menu is required to manipulate the top bar
const { globalShortcut, Menu } = require('electron');

let registeredShortcuts = [];

function toElectronAccelerator(keys) {
  return keys.map(k => {
    k = k.toLowerCase();
    if (k === 'cmd' || k === 'win') return 'Command';
    if (k === 'option' || k === 'alt') return 'Alt';
    if (k === 'ctrl' || k === 'control') return 'Control';
    if (k === 'shift') return 'Shift';
    if (k === 'escape' || k === 'esc') return 'Escape';
    return k.toUpperCase();
  }).join('+');
}

function initKeyboardHook(callback) {
  console.log('[Mac] Keyboard hook initialized');
  return true;
}

function stopKeyboardHook() {
  globalShortcut.unregisterAll();
  registeredShortcuts = [];
  console.log('[Mac] All keyboard shortcuts released');
  return true;
}

function setBlockedCombinations(combinations) {
  globalShortcut.unregisterAll();
  registeredShortcuts = [];
  
  // --- NEW: MAC MENU HARDENING ---
  // We replace the default menu with one that DOES NOT include "Quit"
  if (process.platform === 'darwin') {
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
                  // REMOVED: { role: 'quit' } <--- This is the key change!
              ]
          },
          {
              label: 'Edit', // Keep Edit so Copy/Paste still works
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
  }
  // -------------------------------

  if (!Array.isArray(combinations)) return false;

  let blockCount = 0;

  combinations.forEach(item => {
    const keys = Array.isArray(item) ? item : (item.keys || []);
    if (keys.length === 0) return;

    const accelerator = toElectronAccelerator(keys);
    
    try {
      // Now that the Menu doesn't steal Cmd+Q, this should work!
      const success = globalShortcut.register(accelerator, () => {
        console.log(`[Security] 🚫 Blocked Key Combination: ${accelerator}`);
      });

      if (success) {
        registeredShortcuts.push(accelerator);
        blockCount++;
      } else {
        console.warn(`[Mac] Failed to register: ${accelerator}`);
      }
    } catch (err) {
      console.error(`[Mac] Error registering: ${accelerator}`, err.message);
    }
  });

  console.log(`[Mac] Successfully blocked ${blockCount} key combinations`);
  return true;
}

// Stubs
function enableMouseRestriction() { return true; }
function disableMouseRestriction() { return true; }
function isNativeLoaded() { return false; }

module.exports = {
  initKeyboardHook,
  stopKeyboardHook,
  setBlockedCombinations,
  enableMouseRestriction,
  disableMouseRestriction,
  isNativeLoaded,
};