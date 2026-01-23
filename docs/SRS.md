# Software Requirements Specification
## Secure OS-Level Restricted IDE with Policy-Driven Kiosk Enforcement

**Version:** 1.0.0  
**Date:** January 17, 2026  
**Status:** Draft

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for a Secure OS-Level Restricted IDE with Policy-Driven Kiosk Enforcement. The system is designed to provide a locked-down development environment for educational or examination contexts.

### 1.2 Scope
The Restricted IDE is a desktop application that:
- Provides a code editor with restricted file system access
- Runs in an enforced kiosk mode preventing user escape
- Validates all user actions through a policy engine
- Offers administrative controls for configuration

### 1.3 Definitions and Acronyms

| Term | Definition |
|------|------------|
| IDE | Integrated Development Environment |
| Kiosk Mode | Operating mode where users cannot exit or access other applications |
| Policy Engine | Central component that validates all user actions |
| Sandbox | Restricted file system area where users can work |
| IPC | Inter-Process Communication |

---

## 2. Overall Description

### 2.1 Product Perspective
The Restricted IDE operates as a system-level application that:
- Replaces the Windows Shell in kiosk mode
- Installs low-level keyboard and mouse hooks
- Monitors and controls process execution
- Restricts file system access

### 2.2 Product Functions
1. **Code Editor** - Monaco-based editor with syntax highlighting
2. **File Management** - Sandboxed file operations
3. **Web Browser** - URL-whitelisted documentation viewer
4. **Policy Enforcement** - Real-time action validation
5. **Admin Panel** - Configuration and monitoring interface
6. **Audit Logging** - Comprehensive event logging

### 2.3 User Classes

| User Class | Description | Access Level |
|------------|-------------|--------------|
| Student/User | Primary user of the IDE | Restricted |
| Administrator | Configures policies and monitors usage | Full |
| System | Background services | System-level |

### 2.4 Operating Environment
- **OS:** Windows 10/11 (64-bit)
- **Runtime:** Node.js LTS, Electron
- **Hardware:** Minimum 4GB RAM, 2GB disk space

---

## 3. Specific Requirements

### 3.1 Functional Requirements

#### 3.1.1 Code Editor (FR-EDIT)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EDIT-001 | System shall provide a code editor with syntax highlighting | High |
| FR-EDIT-002 | System shall support file operations (new, open, save) | High |
| FR-EDIT-003 | System shall restrict file access to sandbox directory | High |
| FR-EDIT-004 | System shall validate file extensions against whitelist | High |
| FR-EDIT-005 | System shall enforce maximum file size limits | Medium |

#### 3.1.2 Security Controls (FR-SEC)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SEC-001 | System shall block Alt+Tab key combination | Critical |
| FR-SEC-002 | System shall block Windows key | Critical |
| FR-SEC-003 | System shall block Ctrl+Esc | Critical |
| FR-SEC-004 | System shall block Alt+F4 | Critical |
| FR-SEC-005 | System shall block Ctrl+Alt+Delete | Critical |
| FR-SEC-006 | System shall monitor running processes | Critical |
| FR-SEC-007 | System shall terminate unauthorized processes | Critical |
| FR-SEC-008 | System shall run in fullscreen mode | High |
| FR-SEC-009 | System shall prevent window minimization | High |

#### 3.1.3 Policy Engine (FR-POL)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-POL-001 | System shall validate all user actions through policy engine | Critical |
| FR-POL-002 | System shall support URL whitelist policies | High |
| FR-POL-003 | System shall support keyboard restriction policies | High |
| FR-POL-004 | System shall support process whitelist policies | High |
| FR-POL-005 | System shall support file access policies | High |
| FR-POL-006 | System shall support time-based restriction policies | Medium |
| FR-POL-007 | Policies shall be configurable without code changes | High |

#### 3.1.4 Admin Panel (FR-ADMIN)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ADMIN-001 | System shall require authentication for admin access | Critical |
| FR-ADMIN-002 | System shall allow policy modification by admin | High |
| FR-ADMIN-003 | System shall allow admin to exit kiosk mode | High |
| FR-ADMIN-004 | System shall display audit logs to admin | High |
| FR-ADMIN-005 | System shall enforce session timeout for admin | Medium |

### 3.2 Non-Functional Requirements

#### 3.2.1 Security (NFR-SEC)

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-SEC-001 | Keyboard hooks shall operate at OS level | Critical |
| NFR-SEC-002 | Password storage shall use bcrypt with cost factor ≥12 | High |
| NFR-SEC-003 | IPC messages shall be validated before processing | High |
| NFR-SEC-004 | Admin sessions shall expire after 5 minutes of inactivity | Medium |

#### 3.2.2 Performance (NFR-PERF)

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-PERF-001 | Application shall start within 5 seconds | Medium |
| NFR-PERF-002 | Policy validation shall complete within 10ms | High |
| NFR-PERF-003 | Process monitoring shall not exceed 5% CPU usage | Medium |

#### 3.2.3 Reliability (NFR-REL)

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-REL-001 | System shall recover from renderer process crashes | High |
| NFR-REL-002 | System shall maintain kiosk mode after recovery | Critical |
| NFR-REL-003 | Audit logs shall persist across restarts | High |

---

## 4. External Interface Requirements

### 4.1 User Interface
- Dark theme consistent with modern IDEs
- Responsive layout with resizable panels
- Keyboard-navigable interface
- Clear visual feedback for blocked actions

### 4.2 Hardware Interfaces
- Keyboard: Low-level hook for input interception
- Mouse: Optional confinement to window bounds
- Display: Fullscreen rendering

### 4.3 Software Interfaces
- Windows API for system hooks
- Node.js N-API for native modules
- Electron IPC for process communication

---

## 5. System Features

### 5.1 Kiosk Mode
**Description:** Prevents users from escaping the application environment.

**Stimulus:** Application startup
**Response:** 
1. Enter fullscreen mode
2. Activate keyboard hooks
3. Start process monitoring
4. Initialize file system sandbox

### 5.2 Policy Validation
**Description:** All user actions are validated against configured policies.

**Stimulus:** User attempts an action
**Response:**
1. Action intercepted
2. Policy engine consulted
3. Action allowed or blocked
4. Result logged

---

## 6. Appendices

### Appendix A: Policy Schema
See `ide-core/policy/schemas/policy.schema.json`

### Appendix B: IPC Channels
See `ide-core/ipc/IpcChannels.js`

### Appendix C: Configuration
See `ide-core/config.js`
