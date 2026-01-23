# Restricted IDE - Installer Scripts

This directory contains PowerShell scripts for installing and configuring the Restricted IDE in kiosk mode.

## ⚠️ WARNING

These scripts make significant changes to Windows configuration. **ALWAYS test in a virtual machine first!**

## Scripts

### install.ps1
Main installation script that:
- Copies application files
- Installs dependencies
- Registers the application
- Creates Start Menu shortcuts

### uninstall.ps1
Removes the Restricted IDE and reverts all changes.

### setup-autostart.ps1
Configures the application to start automatically on boot:
- Creates registry entries for auto-start
- Optionally configures Shell replacement

### setup-kiosk.ps1
Configures full kiosk mode:
- Creates restricted user account
- Configures auto-login
- Replaces Windows Shell
- Disables task switching
- Sets up Group Policy restrictions

### create-user.ps1
Creates a restricted Windows user account for kiosk use:
- Limited permissions
- No admin rights
- Restricted shell access

## Usage

### Basic Installation
```powershell
# Run as Administrator
.\install.ps1
```

### Full Kiosk Setup
```powershell
# Run as Administrator
.\install.ps1
.\create-user.ps1 -Username "student" -Password "SecurePassword123!"
.\setup-kiosk.ps1 -Username "student"
.\setup-autostart.ps1 -ShellReplacement
```

### Uninstall
```powershell
# Run as Administrator
.\uninstall.ps1 -Full
```

## Requirements

- Windows 10/11
- PowerShell 5.1 or later
- Administrator privileges
- .NET Framework 4.7.2+

## Testing

1. Create a Windows VM snapshot
2. Run installation scripts
3. Reboot and test kiosk functionality
4. Test all escape vectors
5. Restore snapshot if issues occur

## Security Notes

- These scripts create SYSTEM-level changes
- Always backup before running
- Test thoroughly before deployment
- Document any customizations
