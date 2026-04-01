#!/usr/bin/env pwsh
<#
.SYNOPSIS
Build and release P10-Export-FLEx to GitHub

.DESCRIPTION
Builds the extension locally and creates a GitHub release with the compiled zip file.
Requires: GitHub CLI (gh) and Node.js/npm

.PARAMETER Version
The version number for the release (e.g., 0.1.0)

.EXAMPLE
./scripts/release.ps1 -Version 0.1.0
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

# Verify gh CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] GitHub CLI (gh) not found. Install from https://cli.github.com" -ForegroundColor Red
    exit 1
}

# Verify npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm not found. Install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$extensionDir = Join-Path $repoRoot "extension"
$zipFile = Join-Path $extensionDir "release" "flex-export_$Version.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "P10-Export-FLEx Release Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build locally
Write-Host "[1/3] Building extension..." -ForegroundColor Green
try {
    Push-Location $extensionDir
    npm run package
    Pop-Location
}
catch {
    Write-Host "[ERROR] Build failed: $_" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $zipFile)) {
    Write-Host "[ERROR] Build completed but zip file not found: $zipFile" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Extension built: $zipFile" -ForegroundColor Green
Write-Host ""

# Step 2: Verify bridge exists
Write-Host "[2/3] Verifying bridge executable..." -ForegroundColor Green
$bridgeExe = Join-Path $extensionDir "dist" "bridge" "FlexTextBridge.exe"
if (-not (Test-Path $bridgeExe)) {
    Write-Host "[WARN] FlexTextBridge.exe not found in dist/bridge/" -ForegroundColor Yellow
    Write-Host "[WARN] Build the bridge locally: cd bridge/FlexTextBridge && dotnet build -c Release" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Continue without bridge? (y/n)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Aborted." -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "[OK] Bridge executable found" -ForegroundColor Green
}

Write-Host ""

# Step 3: Create GitHub release
Write-Host "[3/3] Creating GitHub release v$Version..." -ForegroundColor Green
try {
    $releaseNotes = @"
## Installation

1. Download `flex-export_$Version.zip` from below
2. Extract the zip to:
   ``````
   %LOCALAPPDATA%\Programs\paratext-10-studio\resources\extensions\flex-export
   ``````
3. Restart Paratext Studio

The extension will be available in your Paratext menu.

For development setup, see [DEVELOPER.md](https://github.com/MattGyverLee/P10-Export-FLEx/blob/main/DEVELOPER.md)
"@

    gh release create "v$Version" `
        $zipFile `
        --title "Release v$Version" `
        --notes $releaseNotes `
        --draft:$false
}
catch {
    Write-Host "[ERROR] Failed to create release: $_" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Release created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Release v$Version is now available on GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
