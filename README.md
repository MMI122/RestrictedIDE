# Secure OS-Level Restricted IDE with Policy-Driven Kiosk Enforcement

[![License](https://img.shields.io/badge/License-Academic-blue.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)]()
[![Node](https://img.shields.io/badge/Node.js-LTS-green.svg)]()
[![Electron](https://img.shields.io/badge/Electron-Latest-blue.svg)]()

> **Final Year Systems + Security + OS Project**  
> Duration: 6 Months | Credits: 3 | Team Project  
> Expected Codebase: 10,000+ Lines of Code

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Prerequisites](#prerequisites)
5. [Project Structure](#project-structure)
6. [Build Instructions](#build-instructions)
7. [Development Workflow](#development-workflow)
8. [Module Documentation](#module-documentation)
9. [Security Model](#security-model)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Contributing](#contributing)

---

## Project Overview

### Goal

Design and implement a custom IDE that runs in a **restricted OS-level kiosk environment**, where:

- An **admin defines allowed resources** (URLs, tools, files)
- Users **cannot escape** the IDE or OS environment
- **OS-level enforcement** prevents task switching, process spawning, or unauthorized access
- All actions are governed by a **policy engine**

### Key Features

| Category | Features |
|----------|----------|
| **IDE** | Code editor, output console, documentation viewer, restricted web viewer |
| **Security** | Keyboard hooks, process monitoring, file system sandbox, fullscreen enforcement |
| **Admin** | Secure login, policy management, audit log viewer, kiosk exit capability |
| **Policy** | URL filtering, shortcut control, process whitelisting, file access rules |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    OPERATING SYSTEM                          │
│         (Keyboard Hooks, Process Control, FS ACL)            │
├──────────────────────────────────────────────────────────────┤
│              SYSTEM CONTROL SERVICES (Native C++)            │
│  ┌─────────────────┬─────────────────┬─────────────────┐     │
│  │ Input Control   │ Process Control │ FS Sandbox      │     │
│  │ (Keyboard/Mouse)│ (Monitor/Kill)  │ (Path/Extension)│     │
│  └─────────────────┴─────────────────┴─────────────────┘     │
├──────────────────────────────────────────────────────────────┤
│              IDE RUNTIME ENVIRONMENT (Electron)              │
│  ┌─────────────────┬─────────────────┬─────────────────┐     │
│  │ Custom IDE UI   │ Secure WebView  │ Code Editor     │     │
│  └─────────────────┴─────────────────┴─────────────────┘     │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                    IPC Bridge                        │     │
│  └─────────────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────────────┤
│              POLICY & ADMIN LAYER                            │
│  ┌─────────────────┬─────────────────┬─────────────────┐     │
│  │ Policy Engine   │ Admin Auth      │ Audit Logging   │     │
│  └─────────────────┴─────────────────┴─────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → Policy Engine → Validation → Execute/Block → Audit Log
                  ↓
           Native Service (if OS-level)
```

---

## Technology Stack

### Required Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js (LTS) | JavaScript runtime |
| Desktop Shell | Electron | Cross-platform desktop app |
| Native Modules | C/C++ | OS-level hooks and controls |
| Build System | CMake + node-gyp | Native module compilation |
| Version Control | Git + GitHub | Source management |
| Testing Environment | VirtualBox/VMware | Kiosk mode testing |

### NOT Allowed

- ❌ Paid kiosk software
- ❌ Browser lockdown tools
- ❌ Third-party exam software
- ❌ Closed-source enforcement tools

**All system control must be custom implemented.**

---

## Prerequisites

### Development Machine Setup

#### 1. Install Node.js (LTS)

```powershell
# Download from https://nodejs.org/
# Or use winget:
winget install OpenJS.NodeJS.LTS

# Verify installation
node --version
npm --version
```

#### 2. Install Visual Studio Build Tools (for C++ compilation)

```powershell
# Download Visual Studio Build Tools 2022
# https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Select these workloads:
# - "Desktop development with C++"
# - Windows 10/11 SDK
```

#### 3. Install CMake

```powershell
winget install Kitware.CMake

# Verify
cmake --version
```

#### 4. Install Python (required by node-gyp)

```powershell
winget install Python.Python.3.11

# Verify
python --version
```

#### 5. Configure npm for native builds

```powershell
npm config set msvs_version 2022
npm install -g node-gyp
```

#### 6. Install Git

```powershell
winget install Git.Git

# Configure
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### 7. Install Testing VM

- Download and install [VirtualBox](https://www.virtualbox.org/) or VMware Workstation
- Create a Windows 10/11 VM for kiosk testing
- **NEVER test kiosk mode on your development machine directly**

---

## Project Structure

```
restricted-ide/
│
├── ide-ui/                          # Electron Renderer Process (UI)
│   ├── editor/                      # Code editor component
│   │   ├── Editor.js                # Main editor class
│   │   ├── EditorConfig.js          # Editor configuration
│   │   ├── SyntaxHighlighter.js     # Syntax highlighting
│   │   └── styles/                  # Editor CSS
│   │
│   ├── webview/                     # Restricted web browser
│   │   ├── SecureWebView.js         # Sandboxed webview
│   │   ├── UrlValidator.js          # URL whitelist checker
│   │   └── styles/
│   │
│   ├── layout/                      # UI layout components
│   │   ├── MainLayout.js            # Primary layout
│   │   ├── Sidebar.js               # Navigation sidebar
│   │   ├── Toolbar.js               # Action toolbar
│   │   ├── Console.js               # Output console
│   │   └── styles/
│   │
│   ├── components/                  # Shared UI components
│   │   ├── Modal.js
│   │   ├── Button.js
│   │   └── Input.js
│   │
│   ├── index.html                   # Main HTML entry
│   ├── renderer.js                  # Renderer entry point
│   └── preload.js                   # Preload script (IPC bridge)
│
├── ide-core/                        # Core Application Logic
│   ├── policy/                      # Policy Engine
│   │   ├── PolicyEngine.js          # Main policy processor
│   │   ├── PolicyLoader.js          # Load policies from config
│   │   ├── PolicyValidator.js       # Validate actions against policies
│   │   ├── rules/                   # Individual rule implementations
│   │   │   ├── UrlRule.js
│   │   │   ├── KeyboardRule.js
│   │   │   ├── ProcessRule.js
│   │   │   ├── FileAccessRule.js
│   │   │   └── TimeRule.js
│   │   └── schemas/                 # Policy JSON schemas
│   │       └── policy.schema.json
│   │
│   ├── ipc/                         # Inter-Process Communication
│   │   ├── IpcMain.js               # Main process IPC handlers
│   │   ├── IpcChannels.js           # Channel definitions
│   │   └── IpcValidator.js          # Message validation
│   │
│   ├── runtime/                     # Runtime management
│   │   ├── RuntimeManager.js        # Application lifecycle
│   │   ├── SessionManager.js        # User session handling
│   │   └── StateManager.js          # Application state
│   │
│   ├── main.js                      # Electron main process entry
│   └── config.js                    # Core configuration
│
├── system-services/                 # Native OS-Level Code (C++)
│   ├── input-control/               # Keyboard & Mouse Hooks
│   │   ├── src/
│   │   │   ├── InputHook.cpp        # Low-level keyboard hook
│   │   │   ├── InputHook.h
│   │   │   ├── KeyboardFilter.cpp   # Key combination filtering
│   │   │   ├── KeyboardFilter.h
│   │   │   ├── MouseFilter.cpp      # Mouse restriction
│   │   │   ├── MouseFilter.h
│   │   │   └── binding.cpp          # Node.js N-API binding
│   │   ├── include/
│   │   ├── CMakeLists.txt
│   │   ├── binding.gyp              # node-gyp configuration
│   │   └── index.js                 # JavaScript interface
│   │
│   ├── process-control/             # Process Monitoring
│   │   ├── src/
│   │   │   ├── ProcessMonitor.cpp   # Monitor running processes
│   │   │   ├── ProcessMonitor.h
│   │   │   ├── ProcessKiller.cpp    # Terminate unauthorized processes
│   │   │   ├── ProcessKiller.h
│   │   │   ├── ProcessWhitelist.cpp # Whitelist management
│   │   │   ├── ProcessWhitelist.h
│   │   │   └── binding.cpp          # Node.js N-API binding
│   │   ├── CMakeLists.txt
│   │   ├── binding.gyp
│   │   └── index.js
│   │
│   └── fs-sandbox/                  # File System Restrictions
│       ├── src/
│       │   ├── FsSandbox.cpp        # File system access control
│       │   ├── FsSandbox.h
│       │   ├── PathValidator.cpp    # Path whitelist validation
│       │   ├── PathValidator.h
│       │   ├── ExtensionFilter.cpp  # File extension filtering
│       │   ├── ExtensionFilter.h
│       │   └── binding.cpp          # Node.js N-API binding
│       ├── CMakeLists.txt
│       ├── binding.gyp
│       └── index.js
│
├── admin-panel/                     # Admin Configuration & Auth
│   ├── auth/                        # Authentication
│   │   ├── AdminAuth.js             # Admin login/logout
│   │   ├── PasswordHash.js          # Secure password hashing
│   │   └── SessionToken.js          # Token management
│   │
│   ├── config/                      # Policy Configuration UI
│   │   ├── PolicyEditor.js          # Edit policies
│   │   ├── UrlManager.js            # Manage URL whitelist
│   │   ├── ProcessManager.js        # Manage process whitelist
│   │   └── FileManager.js           # Manage file access rules
│   │
│   ├── logs/                        # Log Viewer
│   │   ├── LogViewer.js             # View audit logs
│   │   ├── LogFilter.js             # Filter and search logs
│   │   └── LogExporter.js           # Export logs
│   │
│   └── ui/                          # Admin UI components
│       ├── AdminLayout.js
│       ├── Dashboard.js
│       └── styles/
│
├── installer/                       # Kiosk Setup & Deployment
│   ├── scripts/
│   │   ├── install.ps1              # PowerShell install script
│   │   ├── uninstall.ps1            # Uninstall script
│   │   ├── setup-autostart.ps1      # Configure auto-start
│   │   ├── setup-kiosk.ps1          # Kiosk mode setup
│   │   └── create-user.ps1          # Create restricted user
│   │
│   ├── config/
│   │   ├── default-policy.json      # Default security policy
│   │   └── kiosk-settings.json      # Kiosk configuration
│   │
│   └── README.md                    # Installation instructions
│
├── logs/                            # Audit Logs (Runtime)
│   ├── .gitkeep
│   └── README.md                    # Log format documentation
│
├── docs/                            # Documentation
│   ├── SRS.md                       # Software Requirements Specification
│   ├── architecture.md              # Architecture documentation
│   ├── security-model.md            # Security model documentation
│   ├── api-reference.md             # API documentation
│   ├── user-manual.md               # User guide
│   ├── admin-manual.md              # Admin guide
│   └── diagrams/                    # Architecture diagrams
│       ├── system-architecture.png
│       ├── data-flow.png
│       └── security-model.png
│
├── tests/                           # Test Suite
│   ├── unit/                        # Unit tests
│   │   ├── policy/
│   │   ├── ipc/
│   │   └── runtime/
│   │
│   ├── integration/                 # Integration tests
│   │   ├── native-modules/
│   │   └── ipc-bridge/
│   │
│   ├── e2e/                         # End-to-end tests
│   │   ├── kiosk-mode/
│   │   └── security/
│   │
│   └── fixtures/                    # Test data
│       ├── policies/
│       └── mock-data/
│
├── .github/                         # GitHub Configuration
│   ├── workflows/
│   │   ├── build.yml                # CI build pipeline
│   │   └── test.yml                 # Test pipeline
│   └── ISSUE_TEMPLATE/
│
├── .vscode/                         # VS Code Configuration
│   ├── launch.json                  # Debug configurations
│   ├── tasks.json                   # Build tasks
│   └── settings.json                # Project settings
│
├── package.json                     # Node.js package manifest
├── package-lock.json
├── .gitignore
├── .eslintrc.js                     # ESLint configuration
├── .prettierrc                      # Prettier configuration
├── tsconfig.json                    # TypeScript config (optional)
└── README.md                        # This file
```

---

## Build Instructions

### Step 1: Clone the Repository

```powershell
git clone https://github.com/your-org/restricted-ide.git
cd restricted-ide
```

### Step 2: Install Node.js Dependencies

```powershell
npm install
```

### Step 3: Build Native Modules

```powershell
# Build all native modules
npm run build:native

# Or build individually:
cd system-services/input-control
npm run build

cd ../process-control
npm run build

cd ../fs-sandbox
npm run build
```

### Step 4: Verify Build

```powershell
# Run verification script
npm run verify

# Expected output:
# ✓ Node.js dependencies installed
# ✓ Native module: input-control
# ✓ Native module: process-control
# ✓ Native module: fs-sandbox
# ✓ Policy engine initialized
# ✓ IPC bridge ready
```

### Step 5: Run in Development Mode

```powershell
# Start Electron in development mode
npm run dev

# With debug logging
npm run dev:debug
```

### Step 6: Build for Production

```powershell
# Create production build
npm run build

# Package as installer
npm run package

# Output: dist/restricted-ide-setup.exe
```

---

## Development Workflow

### Daily Development

```powershell
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Rebuild native modules if changed
npm run build:native

# 4. Start development
npm run dev
```

### Module Development

#### Working on Native Modules (C++)

```powershell
cd system-services/input-control

# Edit C++ source files
# ...

# Rebuild
npm run build

# Test
npm test

# Return to root
cd ../..
```

#### Working on Policy Engine

```powershell
# Edit ide-core/policy/* files

# Run policy tests
npm run test:policy

# Test with sample policies
npm run test:policy:integration
```

### Branch Strategy

```
main           → stable release branch
├── develop    → integration branch
├── feature/*  → feature branches
├── bugfix/*   → bug fix branches
└── release/*  → release preparation
```

### Commit Convention

```
feat: add keyboard hook for Win key blocking
fix: resolve memory leak in process monitor
docs: update security model documentation
test: add unit tests for policy engine
refactor: extract URL validation logic
```

---

## Module Documentation

### 1. IDE UI (`ide-ui/`)

**Responsibility**: Electron renderer process, user interface

**Key Components**:
- `Editor`: Monaco-based code editor with restricted file access
- `SecureWebView`: Sandboxed browser with URL whitelist enforcement
- `Console`: Output display for code execution
- `Layout`: Application chrome and navigation

**Communication**: Uses IPC preload bridge to communicate with main process

### 2. IDE Core (`ide-core/`)

**Responsibility**: Main process logic, policy enforcement, IPC

**Key Components**:
- `PolicyEngine`: Central policy validation
- `IpcMain`: IPC message handlers
- `RuntimeManager`: Application lifecycle management

**Security Note**: All sensitive operations go through PolicyEngine

### 3. System Services (`system-services/`)

**Responsibility**: OS-level enforcement via native code

#### Input Control
- Low-level keyboard hooks (WH_KEYBOARD_LL)
- Block: Alt+Tab, Alt+F4, Win key, Ctrl+Esc, Ctrl+Alt+Del
- Mouse boundary enforcement

#### Process Control
- Enumerate running processes
- Detect new process spawning
- Terminate unauthorized processes
- Whitelist management

#### FS Sandbox
- Intercept file system calls
- Path whitelist enforcement
- Extension filtering
- Prevent access outside sandbox

### 4. Admin Panel (`admin-panel/`)

**Responsibility**: Administrative interface and configuration

**Features**:
- Secure admin authentication
- Policy CRUD operations
- Audit log viewer
- Kiosk mode exit

### 5. Installer (`installer/`)

**Responsibility**: Deployment and kiosk setup

**Scripts**:
- Create restricted Windows user
- Configure auto-login and auto-start
- Set up Shell replacement
- Configure Group Policy (optional)

---

## Security Model

### Defense Layers

```
Layer 1: UI Restrictions (Electron)
    ↓ (Can be bypassed)
Layer 2: IPC Validation (Policy Engine)
    ↓ (Can be bypassed with effort)
Layer 3: Native Hooks (C++ Services)
    ↓ (OS-level, hard to bypass)
Layer 4: Windows User Restrictions
    ↓ (Requires admin to bypass)
Layer 5: Group Policy (Optional)
```

### Blocked Actions

| Action | Blocking Method | Layer |
|--------|-----------------|-------|
| Alt+Tab | Keyboard hook | Native |
| Win key | Keyboard hook | Native |
| Ctrl+Esc | Keyboard hook | Native |
| Task Manager | Process monitor | Native |
| cmd.exe/powershell | Process whitelist | Native |
| File Explorer | Process whitelist | Native |
| Unauthorized URLs | Policy engine | IPC |
| File access outside sandbox | FS Sandbox | Native |

### Audit Logging

All actions are logged:

```json
{
  "timestamp": "2026-01-17T10:30:00.000Z",
  "action": "KEYBOARD_BLOCKED",
  "details": {
    "keys": ["Alt", "Tab"],
    "allowed": false
  },
  "user": "student01",
  "session": "abc123"
}
```

---

## Testing

### Run All Tests

```powershell
npm test
```

### Test Categories

```powershell
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests (requires VM)
npm run test:e2e

# Security tests
npm run test:security
```

### Testing in VM

1. Create a snapshot of clean Windows VM
2. Copy built installer to VM
3. Run installation
4. Test all escape vectors:
   - Keyboard shortcuts
   - Process spawning
   - File access
   - Network access
5. Restore snapshot after testing

---

## Deployment

### Create Installer

```powershell
npm run package
```

### Deploy to Target Machine

1. Boot into target machine as Administrator
2. Run `restricted-ide-setup.exe`
3. Follow setup wizard:
   - Create restricted user account
   - Configure auto-start
   - Set initial admin password
   - Import policy configuration
4. Reboot to enter kiosk mode

### Exit Kiosk Mode

1. Press secret key combination (configurable)
2. Enter admin password
3. Select "Exit Kiosk Mode"
4. System returns to normal Windows

---

## Contributing

### Code Style

- JavaScript: ESLint + Prettier
- C++: Clang-format with project config
- Meaningful variable names
- Comments for complex logic
- JSDoc for all public functions

### Pull Request Process

1. Create feature branch from `develop`
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR with detailed description
6. Address review feedback
7. Squash merge to `develop`

### Security Considerations

- Never log sensitive data (passwords, tokens)
- Validate all IPC messages
- Assume user is adversarial
- Test escape vectors in VM
- Document security assumptions

---

## License

This project is developed for academic purposes as a Final Year Project.

---

## Team

| Role | Responsibility |
|------|----------------|
| Lead Developer | Architecture, core modules |
| Security Engineer | Native modules, security testing |
| UI Developer | Electron UI, admin panel |
| QA Engineer | Testing, documentation |

---

## Acknowledgments

- Course Instructor
- University Department
- Open source libraries used

---

## Quick Reference

### Common Commands

```powershell
npm install          # Install dependencies
npm run dev          # Start development
npm run build        # Production build
npm run build:native # Build C++ modules
npm test             # Run tests
npm run package      # Create installer
```

### Important Files

| File | Purpose |
|------|---------|
| `ide-core/main.js` | Electron main entry |
| `ide-ui/renderer.js` | Renderer entry |
| `ide-core/policy/PolicyEngine.js` | Policy validation |
| `installer/config/default-policy.json` | Default policy |

### Getting Help

1. Check existing documentation in `docs/`
2. Search GitHub issues
3. Ask team lead
4. Create new issue with details

---

**Last Updated**: January 17, 2026  
**Version**: 0.1.0 (Initial Setup)
