# Install all prerequisites for WorkshopHub training on Windows.
#
# Tools installed via winget:
#   - Node.js 24 LTS
#   - pnpm
#   - Rancher Desktop (Docker runtime + Docker CLI + Docker Compose)
#   - Git for Windows (includes Git Bash with make)
#   - Trivy (security scanner)
#
# Note: CI build uses shared GitLab/GitHub runners — no self-hosted runner install.
#
# Usage:
#   Open PowerShell (no Administrator needed) and run:
#   .\setup\install-prerequisites-windows.ps1
#
# Requirements:
#   - Windows 10 (1709+) or Windows 11
#   - winget (comes with App Installer from the Microsoft Store)

$ErrorActionPreference = "Stop"

Write-Host "======================================================"
Write-Host "  WorkshopHub Training -- Prerequisites Installer"
Write-Host "  Windows"
Write-Host "======================================================"
Write-Host ""

# ── winget check ───────────────────────────────────────
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: winget is not available."
    Write-Host ""
    Write-Host "Install 'App Installer' from the Microsoft Store, then re-run this script."
    Write-Host "  https://apps.microsoft.com/detail/9NBLGGH4NNS1"
    exit 1
}
Write-Host "✓ winget is available ($(winget --version))"
Write-Host ""

# ── Helper: check if a command exists ──────────────────
function Test-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ── Helper: install via winget if not present ──────────
function Install-IfMissing {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WingetId
    )
    if (Test-Command $Command) {
        $ver = & $Command --version 2>$null | Select-Object -First 1
        Write-Host "✓ $Name already installed ($ver)"
    } else {
        Write-Host "-> Installing $Name..."
        winget install --id $WingetId --silent --accept-package-agreements --accept-source-agreements
        Write-Host "✓ $Name installed"
    }
    Write-Host ""
}

# ── Node.js 24 LTS ─────────────────────────────────────
if (Test-Command node) {
    $nodeVer = node --version
    Write-Host "✓ Node.js already installed ($nodeVer)"
    if ($nodeVer -notlike "v24*") {
        Write-Host "  WARNING: Node.js v24 LTS is recommended. Current: $nodeVer"
        Write-Host "  To upgrade: winget install --id OpenJS.NodeJS.LTS --silent"
    }
} else {
    Write-Host "-> Installing Node.js 24 LTS..."
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    Write-Host "✓ Node.js installed"
}
Write-Host ""

# ── pnpm ───────────────────────────────────────────────
Install-IfMissing -Name "pnpm" -Command "pnpm" -WingetId "pnpm.pnpm"

# ── Git for Windows (provides Git Bash and make) ───────
if (Test-Command git) {
    Write-Host "✓ Git already installed ($(git --version))"
} else {
    Write-Host "-> Installing Git for Windows..."
    winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
    Write-Host "✓ Git installed"
}
Write-Host ""

# ── Rancher Desktop (Docker runtime) ───────────────────
$rancherInstalled = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" `
    -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Rancher Desktop*" }

if ($rancherInstalled) {
    Write-Host "✓ Rancher Desktop already installed"
} else {
    Write-Host "-> Installing Rancher Desktop (Docker runtime + Docker Compose)..."
    winget install --id suse.RancherDesktop --silent --accept-package-agreements --accept-source-agreements
    Write-Host "✓ Rancher Desktop installed"
    Write-Host ""
    Write-Host "  IMPORTANT: Launch Rancher Desktop from the Start menu and"
    Write-Host "  wait for it to finish initialising before continuing."
    Write-Host "  Rancher Desktop includes Docker CLI and Docker Compose."
}
Write-Host ""

# ── Trivy ──────────────────────────────────────────────
Install-IfMissing -Name "Trivy" -Command "trivy" -WingetId "Aquasecurity.Trivy"

# ── make via Git Bash ──────────────────────────────────
Write-Host "NOTE: 'make' is available inside Git Bash."
Write-Host "  Run all 'make' commands in Git Bash, not in PowerShell."
Write-Host "  Open Git Bash: Start menu -> Git Bash"
Write-Host ""

Write-Host "======================================================"
Write-Host "  All prerequisites installed!"
Write-Host ""
Write-Host "  IMPORTANT: Open a new terminal (or Git Bash) so"
Write-Host "  newly installed tools are available on your PATH."
Write-Host ""
Write-Host "  Next step: follow setup/setup-prompt.md"
Write-Host "  Use Git Bash for all 'make' commands."
Write-Host "======================================================"
