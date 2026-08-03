# Install and configure a GitLab self-hosted runner on Windows.
#
# Prerequisites:
#   - Windows 10/11
#   - PowerShell 5.1+ (run as Administrator for service installation)
#   - GitLab project membership (collaborator)
#
# Usage (run in PowerShell as Administrator from inside your cloned team repo):
#   .\setup\runner\setup-runner-windows.ps1

$ErrorActionPreference = "Stop"

$RunnerDir = "C:\gitlab-runner"
$RunnerBin = "$RunnerDir\gitlab-runner.exe"
$GlUrl = "https://gitlab.com"
$GlOrg = "thoughtworks-trainings"
$DefaultRepo = Split-Path -Leaf (Get-Location)

Write-Host "======================================================"
Write-Host "  WorkshopHub Training -- GitLab Self-hosted Runner"
Write-Host "  Windows installer"
Write-Host "======================================================"
Write-Host ""

# Confirm repo name (default to current folder)
$GlRepoInput = Read-Host "Repository name [$DefaultRepo]"
$GlRepo = if ([string]::IsNullOrWhiteSpace($GlRepoInput)) { $DefaultRepo } else { $GlRepoInput }

Write-Host ""
Write-Host "Group/Org  : $GlOrg"
Write-Host "Repository : $GlRepo"
Write-Host ""
Write-Host "You need a runner registration token from GitLab."
Write-Host "Steps to get it:"
Write-Host "  1. Go to: $GlUrl/$GlOrg/$GlRepo/-/settings/ci_cd"
Write-Host "  2. Expand the 'Runners' section"
Write-Host "  3. Click 'New project runner'"
Write-Host "  4. Set tags: self-hosted, workshophub  (required — the CI pipeline uses both tags)"
Write-Host "  5. Click 'Create runner'"
Write-Host "  6. Copy the token shown (starts with 'glrt-')"
Write-Host ""
$RunnerTokenSecure = Read-Host "Runner registration token (glrt-...)" -AsSecureString
$RunnerToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($RunnerTokenSecure)
)

if ([string]::IsNullOrWhiteSpace($RunnerToken)) {
    Write-Error "Runner registration token is required."
    exit 1
}

# Create runner directory
if (-not (Test-Path $RunnerDir)) {
    New-Item -ItemType Directory -Path $RunnerDir | Out-Null
}

# Download gitlab-runner.exe if not present
if (Test-Path $RunnerBin) {
    $ver = & $RunnerBin --version 2>$null | Select-Object -First 1
    Write-Host "✓ gitlab-runner already installed ($ver)"
} else {
    Write-Host "Downloading gitlab-runner.exe..."
    Invoke-WebRequest `
        -Uri "https://gitlab-runner-downloads.s3.amazonaws.com/latest/binaries/gitlab-runner-windows-amd64.exe" `
        -OutFile $RunnerBin
    Write-Host "✓ gitlab-runner.exe downloaded to $RunnerDir"
}
Write-Host ""

# Register the runner with GitLab
Write-Host "Registering runner with GitLab..."
& $RunnerBin register `
    --non-interactive `
    --url $GlUrl `
    --token $RunnerToken `
    --executor "shell" `
    --shell "bash" `
    --description "$env:COMPUTERNAME-workshophub" `
    --tag-list "self-hosted,workshophub,Windows" `
    --run-untagged=false

Write-Host "✓ Runner registered"
Write-Host ""

# Install and start as a Windows service (requires Administrator)
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($IsAdmin) {
    Write-Host "Installing runner as a Windows service..."
    & $RunnerBin install
    & $RunnerBin start
    Write-Host "✓ Runner service started"
} else {
    Write-Host "NOTE: Not running as Administrator. Cannot install as a Windows service."
    Write-Host "To install as a service (recommended), re-run this script as Administrator."
    Write-Host ""
    Write-Host "Starting runner in this terminal (manual mode)..."
    Start-Process -FilePath $RunnerBin -ArgumentList "run" -NoNewWindow
}

Write-Host ""
Write-Host "======================================================"
Write-Host "  Runner installed and running!"
Write-Host ""
Write-Host "  To verify: $GlUrl/$GlOrg/$GlRepo"
Write-Host "             Settings -> CI/CD -> Runners"
Write-Host "             Your runner should appear as online (green circle)"
Write-Host ""
Write-Host "  To stop:   C:\gitlab-runner\gitlab-runner.exe stop"
Write-Host "  To start:  C:\gitlab-runner\gitlab-runner.exe start"
Write-Host "  To remove: .\setup\runner\cleanup-runner-windows.ps1"
Write-Host "======================================================"
