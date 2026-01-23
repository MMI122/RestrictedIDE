/**
 * Renderer Process - Main UI Logic
 * 
 * This script runs in the renderer process and handles all UI interactions.
 * It communicates with the main process only through the exposed restrictedIDE API.
 * 
 * @module ide-ui/renderer
 */

'use strict';

// Ensure we have the IPC bridge
if (!window.restrictedIDE) {
  console.error('restrictedIDE API not available!');
  document.body.innerHTML = '<h1>Error: Application not properly initialized</h1>';
  throw new Error('restrictedIDE API not available');
}

const api = window.restrictedIDE;

/**
 * Application State
 */
const state = {
  currentFile: null,
  openFiles: new Map(),
  sandboxPath: null,
  sessionId: null,
  isAdmin: false,
};

/**
 * DOM Elements
 */
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  app: document.getElementById('app'),
  fileTree: document.getElementById('file-tree'),
  tabBar: document.getElementById('tab-bar'),
  editor: document.getElementById('editor'),
  welcomeScreen: document.getElementById('welcome-screen'),
  outputContent: document.getElementById('output-content'),
  statusSession: document.getElementById('status-session'),
  statusTime: document.getElementById('status-time'),
  panelTitle: document.getElementById('panel-title'),
  panelContent: document.getElementById('panel-content'),
};

// ============================================
// Initialization
// ============================================

/**
 * Initialize the application
 */
async function initialize() {
  try {
    log('Initializing application...');
    
    // Get sandbox path
    const sandboxResult = await api.fs.getSandboxPath();
    if (sandboxResult.success) {
      state.sandboxPath = sandboxResult.data;
      log(`Sandbox path: ${state.sandboxPath}`);
    }
    
    // Get session info
    const sessionResult = await api.runtime.getSession();
    if (sessionResult.success) {
      state.sessionId = sessionResult.data.id;
      elements.statusSession.textContent = `Session: ${state.sessionId.slice(0, 8)}`;
    }
    
    // Load file tree
    await loadFileTree(state.sandboxPath);
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup notification handlers
    setupNotificationHandlers();
    
    // Start time display
    startTimeDisplay();
    
    // Hide loading, show app
    elements.loadingOverlay.classList.add('hidden');
    elements.app.classList.remove('hidden');
    
    log('Application initialized successfully');
    
  } catch (error) {
    console.error('Initialization error:', error);
    showNotification('Failed to initialize application', 'error');
  }
}

// ============================================
// File Tree
// ============================================

/**
 * Load and display file tree
 * @param {string} dirPath - Directory path
 */
async function loadFileTree(dirPath) {
  if (!dirPath) {
    elements.fileTree.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">No sandbox configured</div>';
    return;
  }
  
  try {
    const result = await api.fs.listDir(dirPath);
    
    if (!result.success) {
      elements.fileTree.innerHTML = `<div style="padding: 10px; color: var(--error);">${result.error}</div>`;
      return;
    }
    
    const entries = result.data;
    
    if (entries.length === 0) {
      elements.fileTree.innerHTML = '<div style="padding: 10px; color: var(--text-secondary);">Sandbox is empty</div>';
      return;
    }
    
    // Sort: folders first, then files
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Render file tree
    elements.fileTree.innerHTML = entries.map(entry => `
      <div class="file-tree-item" data-path="${escapeHtml(entry.path)}" data-type="${entry.isDirectory ? 'folder' : 'file'}">
        <span class="file-tree-icon">${entry.isDirectory ? '📁' : '📄'}</span>
        <span>${escapeHtml(entry.name)}</span>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('Failed to load file tree:', error);
    elements.fileTree.innerHTML = '<div style="padding: 10px; color: var(--error);">Failed to load files</div>';
  }
}

// ============================================
// File Operations
// ============================================

/**
 * Open a file in the editor
 * @param {string} filePath - File path
 */
async function openFile(filePath) {
  log(`Opening file: ${filePath}`);
  
  // Check if already open
  if (state.openFiles.has(filePath)) {
    switchToFile(filePath);
    return;
  }
  
  try {
    const result = await api.fs.readFile(filePath);
    
    if (!result.success) {
      showNotification(`Cannot open file: ${result.error}`, 'error');
      return;
    }
    
    const content = result.data;
    const fileName = filePath.split(/[/\\]/).pop();
    
    // Store file data
    state.openFiles.set(filePath, {
      path: filePath,
      name: fileName,
      content: content,
      modified: false,
    });
    
    // Add tab
    addTab(filePath, fileName);
    
    // Switch to file
    switchToFile(filePath);
    
    log(`File opened: ${fileName}`);
    
  } catch (error) {
    console.error('Failed to open file:', error);
    showNotification('Failed to open file', 'error');
  }
}

/**
 * Save the current file
 */
async function saveCurrentFile() {
  if (!state.currentFile) {
    return;
  }
  
  const fileData = state.openFiles.get(state.currentFile);
  if (!fileData) {
    return;
  }
  
  log(`Saving file: ${state.currentFile}`);
  
  try {
    // Get current content from editor
    const editorContent = document.getElementById('editor-textarea');
    if (editorContent) {
      fileData.content = editorContent.value;
    }
    
    const result = await api.fs.writeFile(state.currentFile, fileData.content);
    
    if (!result.success) {
      showNotification(`Cannot save file: ${result.error}`, 'error');
      return;
    }
    
    fileData.modified = false;
    updateTab(state.currentFile);
    showNotification('File saved', 'success');
    log(`File saved: ${fileData.name}`);
    
  } catch (error) {
    console.error('Failed to save file:', error);
    showNotification('Failed to save file', 'error');
  }
}

/**
 * Create a new file
 */
async function createNewFile() {
  const fileName = prompt('Enter file name:', 'untitled.txt');
  if (!fileName) {
    return;
  }
  
  const filePath = `${state.sandboxPath}\\${fileName}`;
  
  try {
    // Check if file exists
    const existsResult = await api.fs.fileExists(filePath);
    if (existsResult.data) {
      showNotification('File already exists', 'warning');
      return;
    }
    
    // Create empty file
    const result = await api.fs.writeFile(filePath, '');
    
    if (!result.success) {
      showNotification(`Cannot create file: ${result.error}`, 'error');
      return;
    }
    
    // Refresh file tree
    await loadFileTree(state.sandboxPath);
    
    // Open the new file
    await openFile(filePath);
    
    showNotification('File created', 'success');
    
  } catch (error) {
    console.error('Failed to create file:', error);
    showNotification('Failed to create file', 'error');
  }
}

// ============================================
// Tab Management
// ============================================

/**
 * Add a tab for a file
 * @param {string} filePath - File path
 * @param {string} fileName - File name
 */
function addTab(filePath, fileName) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.path = filePath;
  tab.innerHTML = `
    <span class="tab-name">${escapeHtml(fileName)}</span>
    <span class="tab-close" title="Close">×</span>
  `;
  
  // Tab click handler
  tab.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab-close')) {
      switchToFile(filePath);
    }
  });
  
  // Close button handler
  tab.querySelector('.tab-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeFile(filePath);
  });
  
  elements.tabBar.appendChild(tab);
}

/**
 * Update tab display
 * @param {string} filePath - File path
 */
function updateTab(filePath) {
  const tab = elements.tabBar.querySelector(`[data-path="${CSS.escape(filePath)}"]`);
  if (!tab) return;
  
  const fileData = state.openFiles.get(filePath);
  if (!fileData) return;
  
  const nameEl = tab.querySelector('.tab-name');
  nameEl.textContent = fileData.modified ? `${fileData.name} •` : fileData.name;
}

/**
 * Switch to a file
 * @param {string} filePath - File path
 */
function switchToFile(filePath) {
  const fileData = state.openFiles.get(filePath);
  if (!fileData) return;
  
  state.currentFile = filePath;
  
  // Update tab selection
  elements.tabBar.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.path === filePath);
  });
  
  // Hide welcome screen
  elements.welcomeScreen.style.display = 'none';
  
  // Show editor with content
  showEditor(fileData.content);
}

/**
 * Close a file
 * @param {string} filePath - File path
 */
function closeFile(filePath) {
  const fileData = state.openFiles.get(filePath);
  
  if (fileData?.modified) {
    if (!confirm('File has unsaved changes. Close anyway?')) {
      return;
    }
  }
  
  // Remove from state
  state.openFiles.delete(filePath);
  
  // Remove tab
  const tab = elements.tabBar.querySelector(`[data-path="${CSS.escape(filePath)}"]`);
  if (tab) {
    tab.remove();
  }
  
  // If this was the current file, switch to another
  if (state.currentFile === filePath) {
    state.currentFile = null;
    
    if (state.openFiles.size > 0) {
      const nextFile = state.openFiles.keys().next().value;
      switchToFile(nextFile);
    } else {
      // Show welcome screen
      elements.welcomeScreen.style.display = 'flex';
      hideEditor();
    }
  }
}

// ============================================
// Editor
// ============================================

/**
 * Show editor with content
 * @param {string} content - File content
 */
function showEditor(content) {
  let textarea = document.getElementById('editor-textarea');
  
  if (!textarea) {
    textarea = document.createElement('textarea');
    textarea.id = 'editor-textarea';
    textarea.style.cssText = `
      width: 100%;
      height: 100%;
      background: var(--bg-primary);
      color: var(--text-primary);
      border: none;
      padding: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      resize: none;
      outline: none;
      tab-size: 2;
    `;
    
    textarea.addEventListener('input', () => {
      if (state.currentFile) {
        const fileData = state.openFiles.get(state.currentFile);
        if (fileData) {
          fileData.modified = true;
          updateTab(state.currentFile);
        }
      }
    });
    
    // Handle tab key
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
      
      // Save shortcut
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
      }
    });
    
    elements.editor.appendChild(textarea);
  }
  
  textarea.value = content;
  textarea.style.display = 'block';
}

/**
 * Hide editor
 */
function hideEditor() {
  const textarea = document.getElementById('editor-textarea');
  if (textarea) {
    textarea.style.display = 'none';
  }
}

// ============================================
// Event Listeners
// ============================================

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // File tree click
  elements.fileTree.addEventListener('click', (e) => {
    const item = e.target.closest('.file-tree-item');
    if (!item) return;
    
    const path = item.dataset.path;
    const type = item.dataset.type;
    
    if (type === 'file') {
      openFile(path);
    } else if (type === 'folder') {
      // TODO: Expand/collapse folder
      loadFileTree(path);
    }
  });
  
  // New file button
  document.getElementById('btn-new-file').addEventListener('click', createNewFile);
  
  // Save button
  document.getElementById('btn-save').addEventListener('click', saveCurrentFile);
  
  // Activity bar items
  document.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.activity-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const panel = item.dataset.panel;
      elements.panelTitle.textContent = panel.charAt(0).toUpperCase() + panel.slice(1);
      
      // Handle different panels
      if (panel === 'explorer') {
        loadFileTree(state.sandboxPath);
      }
    });
  });
  
  // Bottom panel tabs
  document.querySelectorAll('.bottom-panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bottom-panel-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
  
  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+S - Save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
    
    // Ctrl+N - New file
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      createNewFile();
    }
  });
}

// ============================================
// Notifications
// ============================================

/**
 * Setup notification handlers
 */
function setupNotificationHandlers() {
  // Policy violation notifications
  api.on('notify:policy-violation', (violation) => {
    log(`Policy violation: ${violation.type} - ${violation.reason}`);
    showNotification(`Blocked: ${violation.reason}`, 'warning');
  });
  
  // System messages
  api.on('notify:system-message', (message) => {
    showNotification(message.text, message.type || 'info');
  });
  
  // Session warnings
  api.on('notify:session-warning', (warning) => {
    showNotification(warning.message, 'warning');
  });
  
  // Time warnings
  api.on('notify:time-warning', (warning) => {
    showNotification(`Time remaining: ${warning.remaining} minutes`, 'warning');
  });
}

/**
 * Show notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, warning, error)
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// Utilities
// ============================================

/**
 * Log message to output panel
 * @param {string} message - Log message
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.textContent = `[${timestamp}] ${message}`;
  elements.outputContent.appendChild(line);
  elements.outputContent.scrollTop = elements.outputContent.scrollHeight;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Start time display in status bar
 */
function startTimeDisplay() {
  const updateTime = () => {
    elements.statusTime.textContent = new Date().toLocaleTimeString();
  };
  
  updateTime();
  setInterval(updateTime, 1000);
}

// ============================================
// Start Application
// ============================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
