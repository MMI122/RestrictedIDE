#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Installs the Restricted IDE application.

.DESCRIPTION
    This script installs the Restricted IDE and configures basic settings.
    Run with Administrator privileges.

.PARAMETER InstallPath
    The installation directory. Default: C:\Program Files\RestrictedIDE

.PARAMETER CreateShortcut
    Whether to create a Start Menu shortcut. Default: $true

.EXAMPLE
    .\install.ps1
    
.EXAMPLE
    .\install.ps1 -InstallPath "D:\Apps\RestrictedIDE"
#>

param(
    [string]$InstallPath = "C:\Program Files\RestrictedIDE",
    [switch]$CreateShortcut = $true
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restricted IDE Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script requires Administrator privileges." -ForegroundColor Red
    exit 1
}

# Define paths
$SourcePath = Split-Path -Parent $PSScriptRoot
$AppDataPath = Join-Path $env:APPDATA "RestrictedIDE"

Write-Host "Source Path: $SourcePath" -ForegroundColor Gray
Write-Host "Install Path: $InstallPath" -ForegroundColor Gray
Write-Host "Data Path: $AppDataPath" -ForegroundColor Gray
Write-Host ""

# Step 1: Create installation directory
Write-Host "[1/6] Creating installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Host "  Created: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "  Directory already exists" -ForegroundColor Gray
}

# Step 2: Copy application files
Write-Host "[2/6] Copying application files..." -ForegroundColor Yellow
$FilesToCopy = @(
    "ide-core",
    "ide-ui",
    "admin-panel",
    "system-services",
    "node_modules",
    "package.json"
)

foreach ($item in $FilesToCopy) {
    $source = Join-Path $SourcePath $item
    $dest = Join-Path $InstallPath $item
    
    if (Test-Path $source) {
        if (Test-Path $dest) {
            Remove-Item -Path $dest -Recurse -Force
        }
        Copy-Item -Path $source -Destination $dest -Recurse -Force
        Write-Host "  Copied: $item" -ForegroundColor Green
    } else {
        Write-Host "  Skipped (not found): $item" -ForegroundColor Gray
    }
}

# Step 3: Create data directories
Write-Host "[3/6] Creating data directories..." -ForegroundColor Yellow
$DataDirs = @(
    $AppDataPath,
    (Join-Path $AppDataPath "config"),
    (Join-Path $AppDataPath "logs"),
    (Join-Path $AppDataPath "policies"),
    (Join-Path $AppDataPath "sandbox")
)

foreach ($dir in $DataDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Green
    }
}

# Step 4: Copy default configuration
Write-Host "[4/6] Copying default configuration..." -ForegroundColor Yellow
$configSource = Join-Path $SourcePath "installer\config\default-policy.json"
$configDest = Join-Path $AppDataPath "policies\user-policy.json"

if ((Test-Path $configSource) -and (-not (Test-Path $configDest))) {
    Copy-Item -Path $configSource -Destination $configDest -Force
    Write-Host "  Copied default policy" -ForegroundColor Green
}

$kioskSource = Join-Path $SourcePath "installer\config\kiosk-settings.json"
$kioskDest = Join-Path $AppDataPath "config\kiosk.json"

if ((Test-Path $kioskSource) -and (-not (Test-Path $kioskDest))) {
    Copy-Item -Path $kioskSource -Destination $kioskDest -Force
    Write-Host "  Copied kiosk settings" -ForegroundColor Green
}

# Step 5: Create Start Menu shortcut
if ($CreateShortcut) {
    Write-Host "[5/6] Creating Start Menu shortcut..." -ForegroundColor Yellow
    $ShortcutPath = Join-Path $env:ALLUSERSPROFILE "Microsoft\Windows\Start Menu\Programs\Restricted IDE.lnk"
    $ExePath = Join-Path $InstallPath "node_modules\.bin\electron.cmd"
    $Arguments = "."
    $WorkingDir = $InstallPath
    
    $WScriptShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $ExePath
    $Shortcut.Arguments = $Arguments
    $Shortcut.WorkingDirectory = $WorkingDir
    $Shortcut.Description = "Restricted IDE - Secure Development Environment"
    $Shortcut.Save()
    
    Write-Host "  Created shortcut: $ShortcutPath" -ForegroundColor Green
} else {
    Write-Host "[5/6] Skipping shortcut creation" -ForegroundColor Gray
}

# Step 6: Set permissions
Write-Host "[6/6] Setting permissions..." -ForegroundColor Yellow
# Make sandbox directory writable by all users
$SandboxPath = Join-Path $AppDataPath "sandbox"
$Acl = Get-Acl $SandboxPath
$AccessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "Users",
    "FullControl",
    "ContainerInherit,ObjectInherit",
    "None",
    "Allow"
)
$Acl.SetAccessRule($AccessRule)
Set-Acl -Path $SandboxPath -AclObject $Acl
Write-Host "  Set sandbox permissions" -ForegroundColor Green

# Complete
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation Path: $InstallPath" -ForegroundColor White
Write-Host "Data Path: $AppDataPath" -ForegroundColor White
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host "  cd `"$InstallPath`"" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor White
Write-Host ""
Write-Host "For kiosk mode setup, run:" -ForegroundColor Yellow
Write-Host "  .\installer\scripts\setup-kiosk.ps1" -ForegroundColor White
Write-Host ""
