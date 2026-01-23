# Team Task 2 - Remaining Work & Project Setup

## 📋 Project Overview

**Project Name:** Secure OS-Level Restricted IDE with Policy-Driven Kiosk Enforcement  
**Current Status:** Core scaffold complete, native modules pending  
**Estimated Remaining Work:** ~8,000+ lines of code

---

## 🚀 How to Run the Project

### Prerequisites

1. **Node.js LTS** (v18.x or v20.x)
2. **Visual Studio Build Tools** (for native module compilation)
3. **Python 3.x** (required by node-gyp)
4. **Git**

### Quick Start

```powershell
# 1. Navigate to project directory
cd c:\Users\rubay\systemproject\restricted-ide

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run dev

# 4. Build for production
npm run build

# 5. Run tests
npm test

# 6. Verify build integrity
npm run verify
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron app in development mode |
| `npm run build` | Create production build |
| `npm test` | Run Jest unit tests |
| `npm run lint` | Check code with ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run verify` | Verify build integrity |

---

## ✅ Completed Tasks

### Phase 1: Foundation (DONE)

- [x] Project structure and folder organization
- [x] README.md with full documentation
- [x] package.json with dependencies
- [x] ESLint and Prettier configuration
- [x] VS Code launch and task configurations
- [x] .gitignore setup

### Phase 2: Core Architecture (DONE)

- [x] Electron main process (`ide-core/main.js`)
- [x] Configuration module (`ide-core/config.js`)
- [x] Logger utility with Winston (`ide-core/utils/Logger.js`)
- [x] IPC channel definitions (`ide-core/ipc/IpcChannels.js`)
- [x] IPC main process handlers (`ide-core/ipc/IpcMain.js`)

### Phase 3: Policy Engine (DONE)

- [x] Policy Engine core (`ide-core/policy/PolicyEngine.js`)
- [x] Policy JSON schema (`ide-core/policy/schemas/policy.schema.json`)
- [x] URL filtering rule (`ide-core/policy/rules/UrlRule.js`)
- [x] Keyboard blocking rule (`ide-core/policy/rules/KeyboardRule.js`)
- [x] Process control rule (`ide-core/policy/rules/ProcessRule.js`)
- [x] File access rule (`ide-core/policy/rules/FileAccessRule.js`)
- [x] Time restriction rule (`ide-core/policy/rules/TimeRule.js`)

### Phase 4: Runtime & Services (DONE)

- [x] Runtime Manager (`ide-core/runtime/RuntimeManager.js`)
- [x] System Service Manager (`ide-core/runtime/SystemServiceManager.js`)
- [x] Native module JavaScript stubs (input-control, process-control, fs-sandbox)
- [x] binding.gyp files for native builds

### Phase 5: UI Foundation (DONE)

- [x] Main HTML layout (`ide-ui/index.html`)
- [x] Secure preload script (`ide-ui/preload.js`)
- [x] Renderer process (`ide-ui/renderer.js`)
- [x] Dark theme IDE styling

### Phase 6: Configuration & Testing (DONE)

- [x] Default policy JSON (`installer/config/default-policy.json`)
- [x] Kiosk settings JSON (`installer/config/kiosk-settings.json`)
- [x] Jest configuration
- [x] Test setup and mocks
- [x] Unit tests for policy rules
- [x] Build verification script
- [x] PowerShell installation script

---

## 🔴 Remaining Tasks

### Phase 7: Native C++ Modules (HIGH PRIORITY)

These are the core security enforcement mechanisms. Currently only JavaScript stubs exist.

#### 7.1 Input Control Module (`system-services/input-control/`)

- [ ] Create `src/input_control.cpp` - Main entry point
- [ ] Implement `WH_KEYBOARD_LL` low-level keyboard hook
- [ ] Implement `WH_MOUSE_LL` mouse hook (optional)
- [ ] Create blocked key combination detection (Alt+Tab, Win key, etc.)
- [ ] Add N-API bindings for JavaScript interface
- [ ] Test keyboard blocking functionality
- [ ] Handle hook cleanup on process exit

**Key Windows APIs:**
```cpp
SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, hInstance, 0);
UnhookWindowsHookEx(hHook);
CallNextHookEx(hHook, nCode, wParam, lParam);
```

#### 7.2 Process Control Module (`system-services/process-control/`)

- [ ] Create `src/process_control.cpp` - Main entry point
- [ ] Implement process enumeration using `EnumProcesses()`
- [ ] Implement process termination with `TerminateProcess()`
- [ ] Add process monitoring with `WaitForSingleObject()`
- [ ] Create process whitelist/blacklist enforcement
- [ ] Add N-API bindings for JavaScript interface
- [ ] Test process blocking functionality

**Key Windows APIs:**
```cpp
EnumProcesses(aProcesses, sizeof(aProcesses), &cbNeeded);
OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
TerminateProcess(hProcess, 1);
GetModuleBaseName(hProcess, NULL, szProcessName, MAX_PATH);
```

#### 7.3 Filesystem Sandbox Module (`system-services/fs-sandbox/`)

- [ ] Create `src/fs_sandbox.cpp` - Main entry point
- [ ] Implement path validation and normalization
- [ ] Create sandbox boundary enforcement
- [ ] Implement file operation interception (optional: minifilter driver)
- [ ] Add path whitelist/blacklist checking
- [ ] Add N-API bindings for JavaScript interface
- [ ] Test file access restrictions

**Alternative Approach:** Use Node.js `fs` module with path checking instead of native hooks.

---

### Phase 8: Admin Panel UI (MEDIUM PRIORITY)

Create a separate admin interface for managing the IDE.

#### 8.1 Admin Panel Structure

```
admin-panel/
├── index.html
├── styles/
│   └── admin.css
├── components/
│   ├── AdminLayout.js
│   ├── LoginForm.js
│   ├── Dashboard.js
│   ├── PolicyEditor.js
│   ├── LogViewer.js
│   └── UserManager.js
└── services/
    └── AdminApi.js
```

#### 8.2 Admin Panel Tasks

- [ ] Create admin login page with password authentication
- [ ] Implement admin dashboard with system status
- [ ] Create policy editor UI (load, edit, save policies)
- [ ] Build log viewer with filtering and search
- [ ] Add kiosk settings configuration panel
- [ ] Implement session timeout display
- [ ] Add password change functionality
- [ ] Create user activity monitoring view

---

### Phase 9: Security Hardening (HIGH PRIORITY)

- [ ] Implement Content Security Policy (CSP) headers
- [ ] Add input sanitization for all user inputs
- [ ] Implement rate limiting for admin authentication
- [ ] Add brute-force protection (account lockout)
- [ ] Encrypt sensitive data at rest (policy files, logs)
- [ ] Implement secure session tokens
- [ ] Add integrity checks for policy files
- [ ] Audit all IPC channels for security vulnerabilities

---

### Phase 10: Code Editor Integration (MEDIUM PRIORITY)

- [ ] Integrate Monaco Editor (VS Code's editor)
- [ ] Implement syntax highlighting
- [ ] Add file open/save functionality within sandbox
- [ ] Create tab management system
- [ ] Implement basic IntelliSense (optional)
- [ ] Add search and replace functionality
- [ ] Create file tree with sandbox restrictions

**Installation:**
```bash
npm install monaco-editor
```

---

### Phase 11: Webview & Browser Control (MEDIUM PRIORITY)

- [ ] Implement secure webview with URL filtering
- [ ] Add navigation controls (back, forward, refresh)
- [ ] Create URL bar with whitelist validation
- [ ] Implement download blocking
- [ ] Add popup blocking
- [ ] Create DevTools disable mechanism
- [ ] Implement certificate validation

---

### Phase 12: Comprehensive Testing (HIGH PRIORITY)

#### 12.1 Unit Tests

- [ ] Complete unit tests for RuntimeManager
- [ ] Add unit tests for SystemServiceManager
- [ ] Add unit tests for IpcMain handlers
- [ ] Add unit tests for Logger
- [ ] Add unit tests for config module
- [ ] Achieve >80% code coverage

#### 12.2 Integration Tests

Create `tests/integration/` directory:

- [ ] Test policy loading and merging
- [ ] Test IPC communication end-to-end
- [ ] Test admin authentication flow
- [ ] Test session timeout handling
- [ ] Test native module initialization

#### 12.3 End-to-End Tests

Create `tests/e2e/` directory:

- [ ] Test keyboard blocking scenarios
- [ ] Test URL filtering in webview
- [ ] Test process blocking
- [ ] Test file access restrictions
- [ ] Test time-based restrictions
- [ ] Test kiosk mode enforcement

---

### Phase 13: Documentation (LOW PRIORITY)

- [ ] Add JSDoc comments to all functions
- [ ] Create API documentation
- [ ] Write user manual
- [ ] Create admin guide
- [ ] Document policy schema with examples
- [ ] Add troubleshooting guide
- [ ] Create deployment guide

---

### Phase 14: Installer & Deployment (FINAL PHASE)

- [ ] Complete PowerShell installation script
- [ ] Add Windows service registration (optional)
- [ ] Create uninstaller script
- [ ] Build MSI/NSIS installer package
- [ ] Add auto-update mechanism (optional)
- [ ] Create system restore point before install
- [ ] Test clean installation on fresh Windows

---

## 📊 Task Distribution Suggestion

### Team Member A: Native Modules
- Phase 7 (all native C++ modules)
- Estimated: 2-3 weeks

### Team Member B: Admin Panel
- Phase 8 (Admin Panel UI)
- Phase 10 (Code Editor Integration)
- Estimated: 2-3 weeks

### Team Member C: Security & Testing
- Phase 9 (Security Hardening)
- Phase 12 (All Testing)
- Estimated: 2-3 weeks

### Team Member D: Features & Documentation
- Phase 11 (Webview Control)
- Phase 13 (Documentation)
- Phase 14 (Installer)
- Estimated: 2-3 weeks

---

## 🔧 Development Tips

### Building Native Modules

```powershell
# Install build tools
npm install -g node-gyp

# Navigate to module directory
cd system-services/input-control

# Configure and build
node-gyp configure
node-gyp build

# The built module will be in build/Release/
```

### Debugging Electron

1. Open VS Code
2. Press `F5` to start debugging
3. Use `Ctrl+Shift+I` in the Electron window to open DevTools
4. Check the terminal for main process logs

### Testing Individual Components

```powershell
# Run specific test file
npm test -- --testPathPattern="PolicyRules"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## 📁 Key Files Reference

| File | Purpose |
|------|---------|
| `ide-core/main.js` | Electron entry point |
| `ide-core/policy/PolicyEngine.js` | Central policy validation |
| `ide-core/runtime/RuntimeManager.js` | Session & lifecycle management |
| `ide-core/ipc/IpcMain.js` | IPC handler registration |
| `ide-ui/preload.js` | Secure IPC bridge |
| `installer/config/default-policy.json` | Default security policy |

---

## ⚠️ Important Notes

1. **Native modules are critical** - The security enforcement relies on these. Prioritize Phase 7.

2. **Test on clean Windows** - Always test the final build on a fresh Windows installation.

3. **Security review** - Before deployment, conduct a thorough security audit of all IPC channels and policy enforcement.

4. **Backup policies** - The policy engine should gracefully handle corrupted policy files by falling back to defaults.

5. **Logging** - All security events should be logged for audit purposes.

---

## 📅 Suggested Timeline

| Week | Tasks |
|------|-------|
| Week 1-2 | Native modules (input-control) |
| Week 3-4 | Native modules (process-control, fs-sandbox) |
| Week 5-6 | Admin Panel UI |
| Week 7-8 | Code Editor & Webview integration |
| Week 9-10 | Security hardening & Testing |
| Week 11-12 | Documentation & Installer |

---

*Last Updated: January 17, 2026*
