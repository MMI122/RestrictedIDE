# Restricted IDE — Changes & Features Added Since Last Commit

**Baseline Commit:** `8b01871` — *"given admin initial configuration"*  
**Author:** Md Mubin Islam Alif  

---

## Overview

My teammate (Mehedi-86) had originally built the project specifically for macOS, which completely broke Windows support. I went through the entire codebase and made it fully **cross-platform** (Windows + macOS), fixed broken functionality, added missing core features that turn this from a basic text editor into an actual **IDE**, and resolved numerous UI/UX bugs along the way.

**Total Impact:** 14 files modified, ~1,941 lines added, ~264 lines removed.

---

## 1. Cross-Platform Support (Windows + macOS)

The original codebase was hardcoded for macOS (`cmd`, `darwin`, Mac-only paths). I rewrote every platform-dependent component to work on both Windows and macOS.

### 1.1. Configuration System (`ide-core/config.js`)
- Added **platform detection** (`process.platform === 'win32'` / `'darwin'`) across the entire config.
- Made `userDataPath` resolve correctly per OS:
  - Windows: `%APPDATA%\RestrictedIDE`
  - macOS: `~/Library/Application Support/RestrictedIDE`
  - Linux fallback: `~/.restricted-ide`
- Split **blocked keyboard combinations** into platform-specific lists:
  - Windows: `Alt+Tab`, `Alt+F4`, `Win+D`, `Ctrl+Alt+Delete`, etc.
  - macOS: `Cmd+Tab`, `Cmd+Q`, `Cmd+Space` (Spotlight), `Cmd+Opt+Esc` (Force Quit), etc.
- Split **process whitelists/blacklists** per platform:
  - Windows: blocks `cmd.exe`, `powershell.exe`, `taskmgr.exe`, `regedit.exe`, `chrome.exe`, `firefox.exe`, etc.
  - macOS: blocks `terminal`, `iterm2`, `activity monitor`, `safari`, etc.
- Split **denied file paths** per platform:
  - Windows: `C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`
  - macOS: `/System`, `/Library`, `/Applications`, `/bin`, `/usr/bin`
- Made **admin key combo** platform-specific:
  - Windows: `Ctrl+Shift+Alt+A`
  - macOS: `Cmd+Shift+Option+A`
- Added `dev:kiosk` npm script to test kiosk mode during development via `FORCE_KIOSK=true`.

### 1.2. Main Process (`ide-core/main.js`)
- Rewrote `createMainWindow()` to be **cross-platform**:
  - Previously hardcoded Mac kiosk settings (`simpleFullscreen`, `titleBarStyle: 'hidden'`, etc.).
  - Now applies `kiosk: true` and platform-specific options conditionally.
  - Window controls (closable, minimizable, resizable, movable) are dynamically set based on whether kiosk mode is enabled.
- Rewrote `setupSecureMenu()`:
  - macOS: Builds custom menu with "Quit" removed (security hardening).
  - Windows: Calls `Menu.setApplicationMenu(null)` to hide the menu entirely.
- Rewrote `registerAdminShortcut()`:
  - Resolves the correct key combo for the current platform.
  - Properly converts `cmd` → `Command` (Mac) or `Control` (Windows), and `win` → `Super` (Windows).
  - Unregisters before re-registering to avoid conflicts after system services initialize.
  - Logs success/failure of shortcut registration.
- Added platform logging on startup: `Platform: Windows` / `macOS` / `Linux`.
- Admin unlock (`admin:unlock-window`) now handles both platforms (macOS: restore traffic light buttons, Windows: just restore window controls).

### 1.3. Input Control Module (`system-services/input-control/index.js`)
- **Fully rewrote** from a Mac-only implementation to a cross-platform one.
- Added native module support — tries to load `input_control.node` for Windows native hooks, falls back to Electron globalShortcut.
- `toElectronAccelerator()` now correctly maps keys for both platforms:
  - `win` → `Super` (Windows) or `Command` (Mac)
  - `cmd` → `Command` (Mac) or `Super` (Windows)
  - `option` → `Alt`, `tab` → `Tab`, `delete` → `Delete`, etc.
- Added `setupMacMenuHardening()` and `setupWindowsMenuHiding()` as separate functions.
- `setBlockedCombinations()` calls the appropriate menu setup per platform.
- Properly wraps `require('electron')` in try/catch so the module doesn't crash if imported outside Electron context.
- Removed the dev-mode auto-start test code that was hardcoded at the bottom of the file.

### 1.4. Process Control Module (`system-services/process-control/index.js`)
- **Fully rewrote** from Mac-only to cross-platform.
- Added `checkProcessesWindows()` — uses `tasklist /FO CSV /NH` to detect blocked processes on Windows.
- Added `checkProcessesMac()` — uses `/bin/ps -A -o pid=,comm=` for macOS.
- `checkProcesses()` auto-selects the right function based on `process.platform`.
- `killProcess()` now uses `taskkill /PID <pid> /F` on Windows vs `process.kill(pid, 'SIGKILL')` on macOS.
- Removed the dev-mode auto-start test code from the bottom of the file.

### 1.5. Policy Files (Cross-Platform Merge)

#### `installer/config/default-policy.json`
- Renamed from "Default Restrictive Policy (macOS)" to "Default Restrictive Policy (Cross-Platform)".
- Added `_windows` and `_darwin` suffixed fields for all platform-specific config:
  - `blocked_windows` / `blocked_darwin` (keyboard)
  - `allowed_windows` / `allowed_darwin` / `blocked_windows` / `blocked_darwin` (processes)
  - `sandboxPath_windows` / `sandboxPath_darwin` (file access)
  - `deniedPaths_windows` / `deniedPaths_darwin` (file access)
  - `secretKeyCombo_windows` / `secretKeyCombo_darwin` (admin)
  - `adminAccessCombo_windows` / `adminAccessCombo_darwin` (kiosk)
- Set the base `blocked`, `allowed`, `sandboxPath`, `deniedPaths`, `adminAccessCombo`, `secretKeyCombo` fields to empty defaults so they don't override platform-specific values.

#### `installer/config/kiosk-settings.json`
- Added `adminAccessCombo_windows` and `adminAccessCombo_darwin`.
- Set base `adminAccessCombo` to empty array.

#### New: `installer/config/default-policy.windows.json`
- Created a dedicated Windows-only policy file with all Windows-specific settings pre-filled.

#### New: `installer/config/kiosk-settings.windows.json`
- Created a dedicated Windows kiosk settings file.

---

## 2. Policy Engine Fixes (`ide-core/policy/PolicyEngine.js`)

- Fixed `validateFileAccess()` — it was returning just `result.allowed` (a boolean) instead of the full result object `{ allowed, reason }`. Other code (like `handleListDir` in `IpcMain.js`) expected the full object. Changed to `return result;`.
- Fixed `mergePolicies()` — the deep merge was letting empty strings (`""`) and `null` values from the policy file override valid defaults from the code config. Added checks to skip `null`, `""`, and `undefined` values during merge. This was critical because the cross-platform policy has empty base fields (e.g., `"sandboxPath": ""`) that should not overwrite the resolved platform-specific sandbox path.
- Added debug logging for `fileAccess` config during `initializeRules()` to help diagnose sandbox path resolution issues.

---

## 3. File & Folder Management

### 3.1. Custom File Creation Dialog
- The original code used `prompt()` to get the file name, which **doesn't work in Electron** (it either does nothing or shows a blank dialog).
- I built a custom HTML dialog overlay in `index.html`:
  - Styled modal with header, input field, path info, and Create/Cancel buttons.
  - CSS classes: `.dialog-overlay`, `.dialog-box`, `.dialog-header`, `.dialog-content`, `.dialog-buttons`, `.dialog-btn`, `.dialog-btn-primary`, `.dialog-btn-secondary`.
  - `z-index: 10000` so it always appears above everything else.
- Updated `createNewFile()` in `renderer.js` to use this custom dialog.
- Dialog shows current location (e.g., "Location: thefolder/") so you know where the file will be created.
- Handles Enter key to confirm and Escape key to cancel.
- Disables the editor textarea while the dialog is open to prevent it from stealing keyboard input.

### 3.2. New Folder Creation
- Added a **"New Folder" button** to the toolbar in `index.html` (SVG folder icon with plus).
- Implemented `createNewFolder()` and `doCreateFolder()` in `renderer.js`.
- Reuses the same dialog as file creation, but changes the header text to "Create New Folder" and placeholder to "folder-name".
- Creates folders via the existing `api.fs.createDir()` IPC call.

### 3.3. Folder Navigation
- Previously, clicking a folder did nothing (`// TODO: Expand/collapse folder`).
- I implemented **full folder navigation**:
  - Clicking a folder calls `loadFileTree(folderPath)` to navigate into it.
  - Added `state.currentDir` to track the currently browsed directory.
  - Added **breadcrumb navigation** — when inside a subfolder, a `← ..` back button appears at the top of the file tree, along with the relative path (e.g., `/ thefolder`).
  - Added `getParentPath()` helper to resolve the parent directory.
  - File and folder creation now uses `state.currentDir` as the target directory (not always the sandbox root).
  - Empty folders show "Empty folder" instead of "Sandbox is empty".

---

## 4. Secure Code Execution System

This was the biggest feature addition. Without code execution, the app was just a text editor, not an IDE. I built the entire code execution pipeline from scratch, with **security as the top priority** — no shell access, no downloads, no way to cheat.

### 4.1. IPC Channels (`ide-core/ipc/IpcChannels.js`)
- Added three new channels:
  - `CODE_RUN: 'code:run'` — Run a file
  - `CODE_STOP: 'code:stop'` — Stop the running process
  - `CODE_INPUT: 'code:input'` — Send stdin input to a running process
- Added two notification channels:
  - `NOTIFY_CODE_OUTPUT: 'notify:code-output'` — Stream stdout/stderr to renderer
  - `NOTIFY_CODE_EXIT: 'notify:code-exit'` — Notify when process exits

### 4.2. Backend Handlers (`ide-core/ipc/IpcMain.js`)
- Added `LANGUAGE_CONFIG` static property mapping file extensions to executables:
  - `.py` → `python` / `python3`
  - `.js` → `node`
  - `.cpp` → `g++` (compile) then run the output binary
  - `.c` → `gcc` (compile) then run the output binary
  - `.java` → `javac` (compile) then `java -cp <dir> <ClassName>`
- Added `handleRunCode()`:
  - Validates the file exists and has a supported extension.
  - Uses `child_process.spawn()` with `shell: false` (critical security — no shell injection possible).
  - Sets minimal environment variables (only `PATH`, `HOME`/`USERPROFILE`, `SystemRoot`).
  - For compiled languages: compiles first, then runs the output binary.
  - Sends `notify:code-output` events for stdout/stderr in real-time.
  - Sends `notify:code-exit` when the process finishes.
  - 30-second timeout (`MAX_EXECUTION_TIME`) kills runaway processes.
- Added `handleStopCode()`:
  - Kills the running child process.
  - Windows: uses `taskkill /PID <pid> /T /F` (the `/T` flag kills the entire process tree).
  - macOS/Linux: uses `process.kill(pid, 'SIGKILL')`.
- Added `handleCodeInput()`:
  - Writes stdin input to the running process via `process.stdin.write()`.
  - Enables interactive programs (e.g., `cin >> x` in C++, `input()` in Python).
- Added `killRunningProcess()` — cleanup helper used before starting a new process.
- Added `setupProcessHandlers()` — wires up stdout/stderr/exit event handlers for a spawned process.

### 4.3. Preload Bridge (`ide-ui/preload.js`)
- Added `code` channel array: `['code:run', 'code:stop', 'code:input']`.
- Included `code` channels in `ALL_INVOKE_CHANNELS`.
- Added receive channels: `'notify:code-output'`, `'notify:code-exit'`.
- Added `code` API object:
  - `code.run(filePath)` — invoke `code:run`
  - `code.stop()` — invoke `code:stop`
  - `code.sendInput(text)` — invoke `code:input`
  - `code.onOutput(callback)` — subscribe to output events (returns unsubscribe function)
  - `code.onExit(callback)` — subscribe to exit events (returns unsubscribe function)

### 4.4. UI (`ide-ui/index.html` + `ide-ui/renderer.js`)
- Added **Run button** (green ▶ play icon) and **Stop button** (red ■ square icon, hidden by default) to the toolbar.
- Added **Run Status indicator** (`<span id="run-status">`) that shows "Running...", "Finished", or "Exit: N".
- Updated the **Output panel**:
  - Monospace font (`Consolas`), `white-space: pre-wrap`, `overflow-y: auto`.
  - Added "Clear" button (`#btn-clear-output`).
  - Default message: "Ready. Open a file and press ▶ Run to execute code."
- Added **Code Input Bar** (`#code-input-bar`) for interactive programs:
  - Hidden by default, appears when a program is running.
  - Has a `>` prompt and an input field.
  - Pressing Enter sends the input to the running process via `sendCodeInput()`.
- Implemented `runCurrentFile()`:
  - Saves the file first.
  - Clears output, subscribes to output/exit events.
  - Shows stop button, hides run button.
  - Displays real-time output with color coding (stdout = white, stderr = red, info = teal).
  - Auto-scrolls to bottom.
- Implemented `stopRunningCode()` and `sendCodeInput()`.
- Added keyboard shortcuts: **F5** to run, **Shift+F5** to stop.

---

## 5. Syntax Highlighting

- Built a complete **syntax highlighting system** for the code editor.
- Supports **5 languages**: Python (`.py`), JavaScript (`.js`), C++ (`.cpp`), C (`.c`), Java (`.java`).
- Color scheme (VS Code Dark+ inspired):
  - Keywords: `#569cd6` (blue)
  - Strings: `#ce9178` (orange)
  - Comments: `#6a9955` (green)
  - Numbers: `#b5cea8` (light green)
  - Preprocessor directives: `#c586c0` (purple) — C/C++ only
- `SYNTAX_RULES` object defines regex patterns for each language:
  - Keywords, strings (single/double/triple-quoted, template literals), comments (single-line + block), numbers, preprocessor directives.
- `highlightCode()` uses a **tokenizer approach**:
  - First pass: finds all regex matches on the raw text with their positions.
  - Second pass: sorts by position, removes overlapping tokens (higher-priority wins).
  - Third pass: builds the final HTML, escaping plain text and wrapping tokens in `<span>` tags.
  - This prevents the bug where regex would match content *inside* previously-inserted HTML tags (e.g., the strings regex matching `"color: #c586c0;"` from a style attribute).

---

## 6. Code Editor Enhancements

### 6.1. Editor Architecture
- Rebuilt the editor from a plain textarea to a **layered architecture**:
  - **Line numbers panel** (left side) — shows line numbers, syncs scroll with editor.
  - **Code area** — contains two layers:
    - **Highlight layer** (`<pre>`) — positioned absolutely behind the textarea, renders the syntax-highlighted HTML.
    - **Textarea** — positioned on top with `color: transparent` and `caret-color: var(--text-primary)`. You type on the transparent textarea while seeing the colored highlight layer behind it.
  - All wrapped in `#editor-wrapper` with `display: flex`.

### 6.2. Auto-Indent
- On pressing **Enter**, the editor automatically:
  - Matches the indentation of the current line.
  - Adds extra indentation after `{` or `:` (for C/C++/Java/Python blocks).

### 6.3. Language Indicator
- Added `#status-language` to the status bar.
- When you switch to a file, it shows the language (e.g., "Python", "C++", "JavaScript"), mapped from the file extension.

---

## 7. Search Functionality

- Implemented `searchInFiles()` in `renderer.js`.
- Added a **Search panel** in the sidebar (replaces the empty panel when clicking the search icon):
  - Text input with "Search in files..." placeholder.
  - Results show file name, line number, and a snippet of the matching line.
  - Clicking a result opens the file.
  - Debounced input (300ms) so it doesn't search on every keystroke.
  - Requires minimum 2 characters to search.
- Fixed **sidebar panel switching** — the inner panels (explorer, search, settings, webview) had the same CSS class `side-panel` as the main sidebar container. Clicking a panel was hiding the entire sidebar. Renamed inner panels to use class `inner-panel` to avoid the conflict.

---

## 8. Admin Access Improvements

### 8.1. Triple-Click Admin Trigger
- Added a 🔒 lock icon in the status bar (`#admin-trigger`).
- Added a triple-click handler — clicking the lock 3 times within 500ms triggers the admin login modal.
- This provides a discreet way to access admin controls without a keyboard shortcut.

### 8.2. Keyboard Shortcut (Backup)
- Added a global `keydown` listener for `Ctrl+Shift+Alt+A` (Windows) / `Cmd+Shift+Option+A` (Mac).
- If detected, it shows the admin login modal via `showAdminLoginModal()`.
- This serves as a backup in case the global shortcut registered at the Electron level gets blocked by the input control system.

### 8.3. Admin Exit
- `handleRequestExit()` in IpcMain now actually quits the app after admin confirms exit (calls `app.quit()` after a 100ms delay). Previously it just returned a result without actually shutting down.

---

## 9. Bug Fixes

### 9.1. `validateFileAccess()` Return Type
- `PolicyEngine.validateFileAccess()` was returning `result.allowed` (boolean) but `IpcMain.handleListDir()` and other callers expected the full object `{ allowed, reason }`. Fixed to return the full result object.

### 9.2. Policy Merge Empty Value Override
- `mergePolicies()` was letting `null`, `""`, and `undefined` values from the policy JSON file override valid defaults from the code config. Added guards to skip these values during merge.

### 9.3. Test Case Fix
- Updated `PolicyRules.test.js` — the `FileAccessRule` test for blocked extensions was checking for `'Extension not allowed'` but the actual error message uses lowercase: `'extension not allowed'`. Fixed the assertion.

### 9.4. Dialog Input Not Accepting Keyboard
- After navigating into a subdirectory and clicking "New File" or "New Folder", the dialog input wouldn't accept typing. Root cause: the editor's transparent textarea was sitting at `z-index: 1` and intercepting keyboard events even though the dialog overlay was visually on top.
- Fixed by disabling the editor textarea (`textarea.disabled = true`) while the dialog is open, and using `setTimeout(() => input.focus(), 50)` to ensure proper focus after the DOM update.

### 9.5. Invisible Editor Text
- After adding syntax highlighting, the editor text became invisible when typing. Root cause: the textarea had `background: var(--bg-primary)` (opaque dark background) which was covering the highlight layer behind it.
- Fixed by setting the textarea background to `transparent` and moving the background color to the `codeArea` container.

### 9.6. Syntax Highlight HTML Leaking Into Visible Text
- When typing C++ preprocessor directives like `#include`, raw HTML like `"color: #c586c0;">#include` would appear as visible text. Root cause: the old `highlightCode()` applied regex replacements sequentially on the same string, so later regexes (like the strings pattern) would match content *inside* HTML tags inserted by earlier replacements (the style attribute quotes looked like code strings).
- Fixed by rewriting `highlightCode()` with a tokenizer approach: find all matches on raw text first, resolve overlaps, then build HTML in a single pass. Regex never runs on previously-inserted HTML.

### 9.7. Double-Escaped Newlines
- Various places in `renderer.js` and `IpcMain.js` had `\\n` (literal backslash-n in the JS source) instead of `\n` (actual newline character). This caused `TypeError: Cannot read properties of null (reading '0')` when code tried to `split('\n')` or `match()` on text containing the literal string `\n`.
- Fixed all occurrences in both files.

### 9.8. Search Panel Hiding Sidebar
- Clicking the search icon in the activity bar was hiding the entire sidebar. Root cause: the inner content panels had the same CSS class `side-panel` as the sidebar container. The panel switching code was hiding all elements with that class, including the container itself.
- Fixed by renaming the inner panels to use class `inner-panel` instead.

---

## 10. Clipboard Security (Kiosk Mode)

Since this is a restricted exam environment, students shouldn't be able to copy answers from outside and paste them into the editor. I added clipboard clearing so that whenever the app gets focus (like when a student Alt+Tabs back to it), the system clipboard gets wiped automatically.

### What I did:
- Imported Electron's `clipboard` module in `ide-core/main.js`.
- On app startup (when kiosk mode is enabled), I call `clipboard.clear()` right away so nothing from before the exam carries over.
- Added a `focus` event listener on the main window — every time the window gets focus, the clipboard is cleared. So even if someone manages to copy something from another app, switching back to the IDE wipes it before they can paste.
- This only runs when `config.kioskMode.enabled` is `true`, so it doesn't interfere during development.

### Why this matters:
- Without this, Ctrl+V from outside was working perfectly fine — there was nothing blocking it. Now the clipboard is empty by the time they try to paste.
- Combined with the existing keyboard restrictions (which already block things like Alt+Tab in full kiosk mode), this adds another layer of security.

---

## 11. Files Modified

| File | Lines Added | Lines Removed | Summary |
|------|------------|---------------|---------|
| `ide-core/config.js` | ~100 | ~15 | Cross-platform config (paths, keys, processes, blacklists) |
| `ide-core/main.js` | ~90 | ~50 | Cross-platform window creation, menu, admin shortcut, clipboard security |
| `ide-core/ipc/IpcChannels.js` | 9 | 0 | Code execution IPC channels |
| `ide-core/ipc/IpcMain.js` | ~380 | ~20 | Code execution backend, error handling, admin exit |
| `ide-core/policy/PolicyEngine.js` | ~20 | ~10 | Fixed return type, merge logic, debug logging |
| `ide-ui/index.html` | ~160 | ~10 | Dialog, toolbar buttons, panels, output, input bar, status bar |
| `ide-ui/preload.js` | ~30 | ~2 | Code execution API bridge |
| `ide-ui/renderer.js` | ~820 | ~30 | Editor, highlighting, folders, search, code exec, admin trigger |
| `installer/config/default-policy.json` | ~60 | ~40 | Cross-platform policy fields |
| `installer/config/kiosk-settings.json` | 4 | 2 | Cross-platform kiosk combos |
| `system-services/input-control/index.js` | ~190 | ~80 | Full cross-platform rewrite |
| `system-services/process-control/index.js` | ~120 | ~50 | Full cross-platform rewrite |
| `tests/unit/policy/PolicyRules.test.js` | 1 | 1 | Fixed case sensitivity in test |
| `package.json` | 1 | 0 | Added `dev:kiosk` script |

### New Files Created
| File | Purpose |
|------|---------|
| `installer/config/default-policy.windows.json` | Dedicated Windows security policy |
| `installer/config/kiosk-settings.windows.json` | Dedicated Windows kiosk settings |

---

## 12. How to Test

```bash
# Development mode (no kiosk, DevTools available)
npm run dev

# Development mode with kiosk enforcement
npm run dev:kiosk

# Run unit tests (22 passing)
npm test
```

### Things to Test:
1. **File creation** — Click New File, type a name, press Enter or click Create.
2. **Folder creation** — Click New Folder, type a name, press Enter.
3. **Folder navigation** — Click a folder to enter it, use `← ..` to go back.
4. **Create file inside folder** — Navigate into a folder, then create a file.
5. **Code execution** — Open a `.py`, `.js`, `.cpp`, `.c`, or `.java` file, click ▶ Run or press F5.
6. **Interactive input** — Run a program that reads input (e.g., `cin >>` or `input()`), type in the input bar.
7. **Stop execution** — Click ■ Stop or press Shift+F5 while code is running.
8. **Search** — Click the search icon, type a query, click a result to open the file.
9. **Syntax highlighting** — Type code in any supported language, see colored keywords/strings/comments.
10. **Admin access** — Triple-click the 🔒 icon or press Ctrl+Shift+Alt+A (Windows).
11. **Clipboard security** — Copy text from an outside app, switch to the IDE, and try to paste — it should be blank.
