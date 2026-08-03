# Remove the GitLab self-hosted runner from this Windows machine.
#
# Usage:
#   .\cleanup-runner-windows.ps1
#   (Run as Administrator to stop the Windows service)
#
# This script:
#   1. Stops and uninstalls the runner Windows service.
#   2. Unregisters the runner from GitLab.
#   3. Optionally removes the runner directory.

$ErrorActionPreference = "Stop"

$RunnerDir = "C:\gitlab-runner"
$RunnerBin = "$RunnerDir\gitlab-runner.exe"

Write-Host "======================================================"
Write-Host "  WorkshopHub Training -- Remove Self-hosted Runner"
Write-Host "  Windows cleanup"
Write-Host "======================================================"
Write-Host ""

if (-not (Test-Path $RunnerBin)) {
    Write-Host "gitlab-runner.exe not found at $RunnerDir. Nothing to remove."
    exit 0
}

# Stop and uninstall the Windows service (requires Administrator)
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($IsAdmin) {
    Write-Host "Stopping and uninstalling runner service..."
    try {
        & $RunnerBin stop
        & $RunnerBin uninstall
        Write-Host "✓ Runner service stopped and uninstalled"
    } catch {
        Write-Host "Could not stop/uninstall service (it may not be running as a service). Continuing..."
    }
} else {
    Write-Host "NOTE: Not running as Administrator — cannot stop the Windows service."
    Write-Host "Attempting to kill any running gitlab-runner processes..."
    Get-Process -Name "gitlab-runner" -ErrorAction SilentlyContinue | Stop-Process -Force
}

# Unregister from GitLab
Write-Host ""
Write-Host "Unregistering all runners configured on this machine from GitLab..."
try {
    & $RunnerBin unregister --all-runners
    Write-Host "✓ Runner(s) unregistered from GitLab"
} catch {
    Write-Host "Warning: Could not contact GitLab. The trainer will remove the runner from the GitLab UI manually."
}

# Optionally remove the runner directory
Write-Host ""
$RemoveDir = Read-Host "Remove runner directory ($RunnerDir)? [y/N]"
if ($RemoveDir -match "^[Yy]$") {
    Set-Location $env:USERPROFILE
    Remove-Item -Recurse -Force $RunnerDir
    Write-Host "✓ Runner directory removed"
}

Write-Host ""
Write-Host "======================================================"
Write-Host "  Runner removed from this machine."
Write-Host ""
Write-Host "  The trainer will confirm the runner is gone from:"
Write-Host "  GitLab -> repo -> Settings -> CI/CD -> Runners"
Write-Host "======================================================"
