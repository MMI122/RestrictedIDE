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
  currentDir: null,   // Currently browsed directory
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
      state.currentDir = state.sandboxPath;
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
  
  // Track current directory
  state.currentDir = dirPath;
  
  try {
    const result = await api.fs.listDir(dirPath);
    
    if (!result.success) {
      elements.fileTree.innerHTML = `<div style="padding: 10px; color: var(--error);">${result.error}</div>`;
      return;
    }
    
    const entries = result.data;
    
    // Build breadcrumb navigation
    let breadcrumb = '';
    const isRoot = dirPath === state.sandboxPath;
    
    if (!isRoot) {
      // Show relative path from sandbox
      const relativePath = dirPath.replace(state.sandboxPath, '').replace(/^[\\/]/, '');
      breadcrumb = `
        <div class="file-tree-breadcrumb" style="padding: 6px 10px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; font-size: 12px;">
          <span class="file-tree-back" data-path="${escapeHtml(getParentPath(dirPath))}" 
                style="cursor: pointer; color: var(--accent); display: flex; align-items: center; gap: 4px;" title="Go back">
            ← ..
          </span>
          <span style="color: var(--text-secondary);">/ ${escapeHtml(relativePath)}</span>
        </div>
      `;
    }
    
    if (entries.length === 0) {
      elements.fileTree.innerHTML = breadcrumb + '<div style="padding: 10px; color: var(--text-secondary);">Empty folder</div>';
      return;
    }
    
    // Sort: folders first, then files
    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    // Render file tree
    elements.fileTree.innerHTML = breadcrumb + entries.map(entry => `
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

/**
 * Get parent directory path
 */
function getParentPath(filePath) {
  const parts = filePath.replace(/[\\/]$/, '').split(/[\\/]/);
  parts.pop();
  return parts.join('\\');
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
 * Create a new file - shows custom dialog
 */
async function createNewFile() {
  // Show custom dialog instead of prompt() which doesn't work in Electron
  const dialog = document.getElementById('new-file-dialog');
  const input = document.getElementById('new-file-name');
  const createBtn = document.getElementById('dialog-create');
  const cancelBtn = document.getElementById('dialog-cancel');
  const dialogHeader = dialog.querySelector('.dialog-header');
  const pathInfo = document.getElementById('dialog-path-info');
  
  // Show which folder we're creating in
  const targetDir = state.currentDir || state.sandboxPath;
  const relativePath = targetDir.replace(state.sandboxPath, '').replace(/^[\\/]/, '') || '/';
  pathInfo.textContent = `Location: ${relativePath}`;
  dialogHeader.textContent = 'Create New File';
  
  // Reset and show dialog
  input.value = 'untitled.txt';
  dialog.classList.remove('hidden');
  // Disable editor textarea so it doesn't steal keypresses
  const editorTextarea = document.getElementById('editor-textarea');
  if (editorTextarea) editorTextarea.disabled = true;
  setTimeout(() => { input.focus(); input.select(); }, 50);
  
  // Return a promise that resolves when user makes a choice
  return new Promise((resolve) => {
    const cleanup = () => {
      dialog.classList.add('hidden');
      if (editorTextarea) editorTextarea.disabled = false;
      createBtn.removeEventListener('click', onCreate);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKeydown);
    };
    
    const onCreate = async () => {
      const fileName = input.value.trim();
      cleanup();
      if (fileName) {
        await doCreateFile(fileName);
      }
      resolve();
    };
    
    const onCancel = () => {
      cleanup();
      resolve();
    };
    
    const onKeydown = (e) => {
      if (e.key === 'Enter') onCreate();
      if (e.key === 'Escape') onCancel();
    };
    
    createBtn.addEventListener('click', onCreate);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
  });
}

/**
 * Actually create the file after dialog confirmation
 */
async function doCreateFile(fileName) {
  const targetDir = state.currentDir || state.sandboxPath;
  const filePath = `${targetDir}\\${fileName}`;
  
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
    
    // Refresh file tree in current directory
    await loadFileTree(targetDir);
    
    // Open the new file
    await openFile(filePath);
    
    showNotification('File created', 'success');
    
  } catch (error) {
    console.error('Failed to create file:', error);
    showNotification('Failed to create file', 'error');
  }
}

// ============================================
// Create New Folder
// ============================================

/**
 * Create a new folder
 */
async function createNewFolder() {
  // Show dialog for folder name
  const dialog = document.getElementById('new-file-dialog');
  const input = document.getElementById('new-file-name');
  const createBtn = document.getElementById('dialog-create');
  const cancelBtn = document.getElementById('dialog-cancel');
  const dialogHeader = dialog.querySelector('.dialog-header');
  
  // Store original values
  const originalHeader = dialogHeader.textContent;
  const originalPlaceholder = input.placeholder;
  
  const pathInfo = document.getElementById('dialog-path-info');
  
  // Show which folder we're creating in
  const targetDir = state.currentDir || state.sandboxPath;
  const relativePath = targetDir.replace(state.sandboxPath, '').replace(/^[\\/]/, '') || '/';
  pathInfo.textContent = `Location: ${relativePath}`;
  
  // Update dialog text for folder
  dialogHeader.textContent = 'Create New Folder';
  input.placeholder = 'folder-name';
  input.value = 'new-folder';
  
  dialog.classList.remove('hidden');
  const editorTextarea = document.getElementById('editor-textarea');
  if (editorTextarea) editorTextarea.disabled = true;
  setTimeout(() => { input.focus(); input.select(); }, 50);
  
  return new Promise((resolve) => {
    const cleanup = () => {
      dialog.classList.add('hidden');
      if (editorTextarea) editorTextarea.disabled = false;
      createBtn.removeEventListener('click', onCreate);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKeydown);
      // Reset dialog text
      dialogHeader.textContent = originalHeader;
      input.placeholder = originalPlaceholder;
    };
    
    const onCreate = async () => {
      const folderName = input.value.trim();
      if (folderName) {
        cleanup();
        await doCreateFolder(folderName);
      }
      resolve();
    };
    
    const onCancel = () => {
      cleanup();
      resolve();
    };
    
    const onKeydown = (e) => {
      if (e.key === 'Enter') onCreate();
      if (e.key === 'Escape') onCancel();
    };
    
    createBtn.addEventListener('click', onCreate);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
  });
}

/**
 * Actually create the folder
 */
async function doCreateFolder(folderName) {
  const targetDir = state.currentDir || state.sandboxPath;
  const folderPath = `${targetDir}\\${folderName}`;
  
  try {
    const result = await api.fs.createDir(folderPath);
    
    if (!result.success) {
      showNotification(`Cannot create folder: ${result.error}`, 'error');
      return;
    }
    
    // Refresh file tree in current directory
    await loadFileTree(targetDir);
    
    showNotification('Folder created', 'success');
    
  } catch (error) {
    console.error('Failed to create folder:', error);
    showNotification('Failed to create folder', 'error');
  }
}

// ============================================
// Code Execution (Secure)
// ============================================

/**
 * State for code execution
 */
const codeExecState = {
  isRunning: false,
  unsubOutput: null,
  unsubExit: null,
};

/**
 * Run the currently open file
 */
async function runCurrentFile() {
  if (!state.currentFile) {
    showNotification('No file open. Open a file first.', 'warning');
    return;
  }

  if (codeExecState.isRunning) {
    showNotification('Code is already running. Stop it first.', 'warning');
    return;
  }

  // Save the file first
  await saveCurrentFile();

  const outputEl = document.getElementById('output-content');
  const inputBar = document.getElementById('code-input-bar');
  const btnRun = document.getElementById('btn-run');
  const btnStop = document.getElementById('btn-stop');
  const runStatus = document.getElementById('run-status');

  // Clear output
  outputEl.innerHTML = '';
  
  // Show input bar and stop button
  inputBar.classList.remove('hidden');
  inputBar.style.display = 'flex';
  btnRun.classList.add('hidden');
  btnStop.classList.remove('hidden');
  runStatus.textContent = 'Running...';
  runStatus.style.color = '#4ec9b0';
  codeExecState.isRunning = true;

  // Unsubscribe any previous listeners
  if (codeExecState.unsubOutput) codeExecState.unsubOutput();
  if (codeExecState.unsubExit) codeExecState.unsubExit();

  // Subscribe to output
  codeExecState.unsubOutput = api.code.onOutput((data) => {
    const span = document.createElement('span');
    
    if (data.type === 'stdout') {
      span.style.color = 'var(--text-primary)';
    } else if (data.type === 'stderr') {
      span.style.color = '#f44747';
    } else if (data.type === 'info') {
      span.style.color = '#4ec9b0';
    }
    
    span.textContent = data.text;
    outputEl.appendChild(span);
    
    // Auto-scroll to bottom
    outputEl.scrollTop = outputEl.scrollHeight;
  });

  // Subscribe to exit
  codeExecState.unsubExit = api.code.onExit((data) => {
    codeExecState.isRunning = false;
    inputBar.classList.add('hidden');
    inputBar.style.display = 'none';
    btnRun.classList.remove('hidden');
    btnStop.classList.add('hidden');

    const exitSpan = document.createElement('span');
    exitSpan.style.color = 'var(--text-secondary)';
    
    if (data.code === 0) {
      exitSpan.textContent = `\n✅ Process exited with code 0\n`;
      runStatus.textContent = 'Finished';
      runStatus.style.color = '#4ec9b0';
    } else {
      exitSpan.textContent = `\n❌ Process exited with code ${data.code}${data.signal ? ` (${data.signal})` : ''}\n`;
      runStatus.textContent = `Exit: ${data.code}`;
      runStatus.style.color = '#f44747';
    }
    
    outputEl.appendChild(exitSpan);
    outputEl.scrollTop = outputEl.scrollHeight;

    // Unsubscribe
    if (codeExecState.unsubOutput) { codeExecState.unsubOutput(); codeExecState.unsubOutput = null; }
    if (codeExecState.unsubExit) { codeExecState.unsubExit(); codeExecState.unsubExit = null; }
  });

  try {
    await api.code.run(state.currentFile);
  } catch (error) {
    console.error('Failed to run code:', error);
    showNotification(`Run failed: ${error.message || error}`, 'error');
    codeExecState.isRunning = false;
    inputBar.classList.add('hidden');
    inputBar.style.display = 'none';
    btnRun.classList.remove('hidden');
    btnStop.classList.add('hidden');
    runStatus.textContent = 'Error';
    runStatus.style.color = '#f44747';
  }
}

/**
 * Stop the running process
 */
async function stopRunningCode() {
  if (!codeExecState.isRunning) return;
  
  try {
    await api.code.stop();
    showNotification('Process stopped', 'info');
  } catch (error) {
    console.error('Failed to stop code:', error);
  }
}

/**
 * Send input to running process
 */
async function sendCodeInput(text) {
  if (!codeExecState.isRunning) return;

  try {
    // Echo the input in the output panel
    const outputEl = document.getElementById('output-content');
    const span = document.createElement('span');
    span.style.color = '#569cd6';
    span.textContent = text + '\n';
    outputEl.appendChild(span);
    outputEl.scrollTop = outputEl.scrollHeight;

    await api.code.sendInput(text);
  } catch (error) {
    console.error('Failed to send input:', error);
  }
}

// ============================================
// Syntax Highlighting (Basic)
// ============================================

/**
 * Language keyword maps for basic syntax highlighting
 */
const SYNTAX_RULES = {
  '.py': {
    keywords: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|yield|lambda|pass|break|continue|and|or|not|in|is|True|False|None|print|input|range|len|int|str|float|list|dict|set|tuple|self)\b/g,
    strings: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    comments: /(#.*$)/gm,
    numbers: /\b(\d+\.?\d*)\b/g,
  },
  '.js': {
    keywords: /\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|class|new|this|typeof|instanceof|try|catch|finally|throw|async|await|import|export|default|from|true|false|null|undefined|console|require|module)\b/g,
    strings: /(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b(\d+\.?\d*)\b/g,
  },
  '.cpp': {
    keywords: /\b(int|float|double|char|void|bool|string|long|short|unsigned|signed|return|if|else|for|while|do|switch|case|break|continue|class|struct|public|private|protected|virtual|override|const|static|new|delete|template|typename|namespace|using|include|iostream|cin|cout|endl|main|true|false|nullptr|std|vector|map|set)\b/g,
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b(\d+\.?\d*[fFdDlL]?)\b/g,
    preprocessor: /(#\s*(?:include|define|ifdef|ifndef|endif|pragma|if|else|elif|undef).*$)/gm,
  },
  '.c': null, // Will use .cpp rules
  '.java': {
    keywords: /\b(public|private|protected|static|final|abstract|class|interface|extends|implements|void|int|float|double|char|boolean|long|short|byte|return|if|else|for|while|do|switch|case|break|continue|new|this|super|try|catch|finally|throw|throws|import|package|null|true|false|String|System|out|println|Scanner|main)\b/g,
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    numbers: /\b(\d+\.?\d*[fFdDlL]?)\b/g,
  },
};
// C uses C++ rules
SYNTAX_RULES['.c'] = SYNTAX_RULES['.cpp'];

/**
 * Apply basic syntax highlighting to code text.
 * Uses a tokenizer approach: find all matches on raw text first,
 * then build HTML output so regex never runs on inserted HTML tags.
 */
function highlightCode(text, ext) {
  const rules = SYNTAX_RULES[ext];
  if (!rules) return escapeHtml(text);

  // Collect all token matches with their positions on the RAW text
  const tokens = [];

  // Priority order: preprocessor > comments > strings > keywords > numbers
  // Higher priority tokens that start earlier (or are found first) win
  const patterns = [];
  if (rules.preprocessor) patterns.push({ regex: rules.preprocessor, color: '#c586c0' });
  patterns.push({ regex: rules.comments, color: '#6a9955' });
  patterns.push({ regex: rules.strings, color: '#ce9178' });
  patterns.push({ regex: rules.keywords, color: '#569cd6' });
  patterns.push({ regex: rules.numbers, color: '#b5cea8' });

  for (const { regex, color } of patterns) {
    // Clone regex to reset lastIndex
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      // Use group 1 if present, otherwise full match
      const captured = match[1] !== undefined ? match[1] : match[0];
      const startOffset = match[0].indexOf(captured);
      const start = match.index + startOffset;
      const end = start + captured.length;
      if (captured.length > 0) {
        tokens.push({ start, end, color });
      }
    }
  }

  // Sort by start position, then by longer match first (higher priority)
  tokens.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Remove overlapping tokens: earlier/higher-priority tokens win
  const filtered = [];
  let lastEnd = 0;
  for (const tok of tokens) {
    if (tok.start >= lastEnd) {
      filtered.push(tok);
      lastEnd = tok.end;
    }
  }

  // Build output: escape plain text, wrap tokens in colored spans
  let result = '';
  let pos = 0;
  for (const tok of filtered) {
    if (tok.start > pos) {
      result += escapeHtml(text.slice(pos, tok.start));
    }
    result += '<span style="color: ' + tok.color + ';">' + escapeHtml(text.slice(tok.start, tok.end)) + '</span>';
    pos = tok.end;
  }
  if (pos < text.length) {
    result += escapeHtml(text.slice(pos));
  }

  return result;
}

// ============================================
// Search Functionality
// ============================================

/**
 * Search in files
 */
async function searchInFiles(query) {
  const resultsContainer = document.getElementById('search-results');
  
  if (!query || query.length < 2) {
    resultsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px;">Type at least 2 characters to search</div>';
    return;
  }
  
  resultsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px;">Searching...</div>';
  
  try {
    // Get all files from sandbox
    const result = await api.fs.listDir(state.sandboxPath);
    if (!result.success) {
      resultsContainer.innerHTML = '<div style="color: var(--error);">Failed to search</div>';
      return;
    }
    
    const matches = [];
    const files = result.data.filter(e => e.isFile);
    
    // Search in each file
    for (const file of files) {
      try {
        const contentResult = await api.fs.readFile(file.path);
        if (contentResult.success) {
          const content = contentResult.data;
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              matches.push({
                file: file.name,
                path: file.path,
                line: index + 1,
                text: line.trim().substring(0, 100)
              });
            }
          });
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
    
    if (matches.length === 0) {
      resultsContainer.innerHTML = '<div style="color: var(--text-secondary); font-size: 12px;">No results found</div>';
      return;
    }
    
    resultsContainer.innerHTML = matches.map(m => `
      <div class="search-result" data-path="${escapeHtml(m.path)}" data-line="${m.line}" 
           style="padding: 8px; border-bottom: 1px solid var(--border); cursor: pointer;">
        <div style="color: var(--accent); font-size: 12px;">${escapeHtml(m.file)}:${m.line}</div>
        <div style="color: var(--text-secondary); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.text)}</div>
      </div>
    `).join('');
    
    // Add click handlers
    resultsContainer.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        openFile(el.dataset.path);
      });
    });
    
  } catch (error) {
    console.error('Search failed:', error);
    resultsContainer.innerHTML = '<div style="color: var(--error);">Search failed</div>';
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
  
  // Update language indicator in status bar
  const ext = filePath.split('.').pop().toLowerCase();
  const langMap = {
    'py': 'Python', 'js': 'JavaScript', 'cpp': 'C++', 'c': 'C',
    'java': 'Java', 'html': 'HTML', 'css': 'CSS', 'json': 'JSON',
    'txt': 'Plain Text', 'md': 'Markdown',
  };
  const langEl = document.getElementById('status-language');
  if (langEl) langEl.textContent = langMap[ext] || ext.toUpperCase();
  
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
  let editorWrapper = document.getElementById('editor-wrapper');
  let textarea = document.getElementById('editor-textarea');
  let highlightLayer = document.getElementById('editor-highlight');
  let lineNumbers = document.getElementById('editor-line-numbers');
  
  if (!editorWrapper) {
    // Create the editor wrapper
    editorWrapper = document.createElement('div');
    editorWrapper.id = 'editor-wrapper';
    editorWrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
    `;
    
    // Line numbers
    lineNumbers = document.createElement('div');
    lineNumbers.id = 'editor-line-numbers';
    lineNumbers.style.cssText = `
      width: 40px;
      min-width: 40px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      padding: 10px 4px;
      text-align: right;
      user-select: none;
      overflow: hidden;
      border-right: 1px solid var(--border);
    `;
    
    // Code area container
    const codeArea = document.createElement('div');
    codeArea.style.cssText = `
      position: relative;
      flex: 1;
      overflow: auto;
      background: var(--bg-primary);
    `;
    
    // Syntax highlight layer (behind textarea)
    highlightLayer = document.createElement('pre');
    highlightLayer.id = 'editor-highlight';
    highlightLayer.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      margin: 0;
      padding: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-primary);
      background: transparent;
      pointer-events: none;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: hidden;
    `;
    
    // Textarea (on top, transparent)
    textarea = document.createElement('textarea');
    textarea.id = 'editor-textarea';
    textarea.spellcheck = false;
    textarea.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      background: transparent;
      color: transparent;
      caret-color: var(--text-primary);
      border: none;
      padding: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      line-height: 1.5;
      resize: none;
      outline: none;
      tab-size: 2;
      z-index: 1;
    `;
    
    const updateHighlight = () => {
      if (state.currentFile) {
        const ext = state.currentFile.split('.').pop();
        const fileExt = '.' + ext;
        highlightLayer.innerHTML = highlightCode(textarea.value, fileExt);
        updateLineNumbers(textarea.value);
      } else {
        highlightLayer.innerHTML = escapeHtml(textarea.value);
      }
    };
    
    const updateLineNumbers = (text) => {
      const lines = text.split('\n').length;
      lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => 
        `<div style="height: 1.5em;">${i + 1}</div>`
      ).join('');
    };
    
    textarea.addEventListener('input', () => {
      updateHighlight();
      if (state.currentFile) {
        const fileData = state.openFiles.get(state.currentFile);
        if (fileData) {
          fileData.modified = true;
          updateTab(state.currentFile);
        }
      }
    });

    textarea.addEventListener('scroll', () => {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
      lineNumbers.scrollTop = textarea.scrollTop;
    });
    
    // Handle tab key
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateHighlight();
      }
      
      // Save shortcut
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
      }

      // Auto-indent on Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, start);
        const currentLine = textBefore.split('\n').pop();
        const indent = currentLine.match(/^\s*/)[0];
        // Extra indent after { or :
        const lastChar = textBefore.trim().slice(-1);
        const extraIndent = (lastChar === '{' || lastChar === ':') ? '  ' : '';
        const insertion = '\n' + indent + extraIndent;
        
        textarea.value = textarea.value.substring(0, start) + insertion + textarea.value.substring(textarea.selectionEnd);
        textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        updateHighlight();
        
        // Trigger input to mark file modified
        textarea.dispatchEvent(new Event('input'));
      }
    });
    
    codeArea.appendChild(highlightLayer);
    codeArea.appendChild(textarea);
    editorWrapper.appendChild(lineNumbers);
    editorWrapper.appendChild(codeArea);
    elements.editor.appendChild(editorWrapper);
  }
  
  textarea.value = content;
  editorWrapper.style.display = 'flex';
  
  // Apply syntax highlighting
  if (state.currentFile) {
    const ext = '.' + state.currentFile.split('.').pop();
    highlightLayer.innerHTML = highlightCode(content, ext);
    const lines = content.split('\n').length;
    lineNumbers.innerHTML = Array.from({length: lines}, (_, i) =>
      `<div style="height: 1.5em;">${i + 1}</div>`
    ).join('');
  }
}

/**
 * Hide editor
 */
function hideEditor() {
  const wrapper = document.getElementById('editor-wrapper');
  if (wrapper) {
    wrapper.style.display = 'none';
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
    // Handle back button click
    const backBtn = e.target.closest('.file-tree-back');
    if (backBtn) {
      const parentPath = backBtn.dataset.path;
      loadFileTree(parentPath);
      return;
    }
    
    const item = e.target.closest('.file-tree-item');
    if (!item) return;
    
    const path = item.dataset.path;
    const type = item.dataset.type;
    
    if (type === 'file') {
      openFile(path);
    } else if (type === 'folder') {
      // Navigate into the folder
      loadFileTree(path);
    }
  });
  
  // New file button
  document.getElementById('btn-new-file').addEventListener('click', createNewFile);
  
  // New folder button
  const btnNewFolder = document.getElementById('btn-new-folder');
  if (btnNewFolder) {
    btnNewFolder.addEventListener('click', createNewFolder);
  }
  
  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        searchInFiles(e.target.value);
      }, 300);
    });
  }
  
  // Save button
  document.getElementById('btn-save').addEventListener('click', saveCurrentFile);
  
  // Run button
  document.getElementById('btn-run').addEventListener('click', runCurrentFile);
  
  // Stop button
  document.getElementById('btn-stop').addEventListener('click', stopRunningCode);
  
  // Code input (for interactive programs)
  const codeInput = document.getElementById('code-input');
  if (codeInput) {
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = codeInput.value;
        codeInput.value = '';
        sendCodeInput(text);
      }
    });
  }
  
  // Clear output button
  const clearBtn = document.getElementById('btn-clear-output');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      document.getElementById('output-content').innerHTML = '<div style="color: var(--text-secondary);">Output cleared.</div>';
    });
  }
  
  // Activity bar items
  document.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.activity-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const panel = item.dataset.panel;
      elements.panelTitle.textContent = panel.charAt(0).toUpperCase() + panel.slice(1);
      
      // Hide all inner panels
      document.querySelectorAll('.inner-panel').forEach(p => p.classList.add('hidden'));
      
      // Show the appropriate panel
      const panelMap = {
        'explorer': 'explorer-panel',
        'search': 'search-panel',
        'settings': 'settings-panel',
        'webview': 'webview-panel'
      };
      
      const targetPanel = document.getElementById(panelMap[panel]);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }
      
      // Handle specific panel actions
      if (panel === 'explorer') {
        loadFileTree(state.currentDir || state.sandboxPath);
      } else if (panel === 'search') {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
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
    
    // F5 or Ctrl+F5 - Run code
    if (e.key === 'F5') {
      e.preventDefault();
      runCurrentFile();
    }
    
    // Shift+F5 - Stop code
    if (e.shiftKey && e.key === 'F5') {
      e.preventDefault();
      stopRunningCode();
    }
  });
}

// ============================================
// Notifications
// ============================================

/**
 * Setup notification handlers
 */
/**
 * Setup notification handlers
 */
function setupNotificationHandlers() {
  // 1. Policy violation notifications
  api.on('notify:policy-violation', (violation) => {
    log(`Policy violation: ${violation.type} - ${violation.reason}`);
    showNotification(`Blocked: ${violation.reason}`, 'warning');
  }); // <--- The previous block MUST end here

  // 2. Admin Login Request (CORRECTLY PLACED HERE)
  api.on('show-admin-login', () => {
    log('🔐 Admin unlock requested');
    showAdminLoginModal();
  });
  
  // 3. System messages
  api.on('notify:system-message', (message) => {
    showNotification(message.text, message.type || 'info');
  });
  
  // 4. Session warnings
  api.on('notify:session-warning', (warning) => {
    showNotification(warning.message, 'warning');
  });
  
  // 5. Time warnings
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

// ============================================
// Admin Access - Triple Click Handler
// ============================================
(function setupAdminTrigger() {
  const trigger = document.getElementById('admin-trigger');
  if (!trigger) return;
  
  let clickCount = 0;
  let clickTimer = null;
  
  trigger.addEventListener('click', () => {
    clickCount++;
    
    if (clickTimer) clearTimeout(clickTimer);
    
    if (clickCount >= 3) {
      // Triple click detected!
      clickCount = 0;
      console.log('🔐 Admin trigger activated via triple-click');
      showAdminLoginModal();
    } else {
      // Reset after 500ms
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 500);
    }
  });
})();

// ============================================
// Admin Access - Keyboard Shortcut (Backup)
// Ctrl+Shift+Alt+A triggers admin login
// ============================================
document.addEventListener('keydown', (e) => {
  // Check for Ctrl+Shift+Alt+A
  if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔐 Admin shortcut detected via keydown: Ctrl+Shift+Alt+A');
    showAdminLoginModal();
  }
});

// ============================================
// Admin Login Modal
// ============================================

/**
 * Show Admin Login Modal
 */
function showAdminLoginModal() {
  // Don't open if already open
  if (document.getElementById('admin-login-modal')) return;

  // Create modal HTML
  const modal = document.createElement('div');
  modal.id = 'admin-login-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); z-index: 9999;
    display: flex; justify-content: center; align-items: center;
  `;
  
  modal.innerHTML = `
    <div style="background: var(--bg-secondary); padding: 2rem; border-radius: 8px; width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid var(--border-color);">
      <h2 style="margin-top: 0; color: var(--text-primary);">🔐 Admin Unlock</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Enter administrator password to unlock.</p>
      
      <input type="password" id="admin-password" placeholder="Password" 
        style="width: 100%; padding: 10px; margin-bottom: 1rem; background: var(--bg-primary); border: 1px solid var(--border-color); color: white; border-radius: 4px;">
      
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button id="btn-cancel-login" style="padding: 8px 16px; background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; border-radius: 4px;">Cancel</button>
        <button id="btn-submit-login" style="padding: 8px 16px; background: var(--accent-primary); border: none; color: white; cursor: pointer; border-radius: 4px;">Unlock</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Focus the input immediately
  const input = document.getElementById('admin-password');
  input.focus();

  // Event Listeners
  document.getElementById('btn-cancel-login').addEventListener('click', hideAdminLoginModal);
  
  document.getElementById('btn-submit-login').addEventListener('click', () => {
    handleAdminLogin(input.value);
  });

  // Allow pressing "Enter" to submit and "Escape" to cancel
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdminLogin(input.value);
    if (e.key === 'Escape') hideAdminLoginModal();
  });
}

/**
 * Hide the modal
 */
function hideAdminLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  if (modal) modal.remove();
}

/**
 * Process the login
 */
async function handleAdminLogin(password) {
  if (!password) return;

  try {
    const result = await api.admin.login(password);
    
    if (result.success) {
      log('✅ Admin login successful');
      showNotification('Admin Mode Enabled', 'success');
      state.isAdmin = true;
      hideAdminLoginModal();
      
      // --- NEW CODE START ---
      // Immediately unlock the window frame/traffic lights
      api.admin.unlockWindow(); 
      // --- NEW CODE END ---
      
      // Ask the user what they want to do
      setTimeout(() => {
        if (confirm('Admin Unlocked successfully.\n\nClick OK to EXIT the application.\nClick Cancel to use the app in Windowed Mode.')) {
           api.admin.requestExit();
        }
      }, 100);
      
    } else {
      showNotification(result.error || 'Invalid password', 'error');
      // Shake animation or clear input could go here
      document.getElementById('admin-password').value = '';
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed', 'error');
  }
}