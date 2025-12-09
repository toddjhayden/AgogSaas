#!/usr/bin/env pwsh
# Setup script for Git aliases
# Run this once per repository to enable short commands

Write-Host "Setting up Git aliases for AGOG workflow scripts..." -ForegroundColor Cyan
Write-Host ""

# Detect platform - use a more reliable method
$IsWindowsPlatform = if ($PSVersionTable.PSVersion.Major -le 5) {
    $true  # Windows PowerShell is always Windows
} elseif ($null -ne $PSVersionTable.Platform) {
    $PSVersionTable.Platform -eq 'Win32NT'
} else {
    $true  # Default to Windows if unclear
}

Write-Host "Detected platform: $(if ($IsWindowsPlatform) { 'Windows (PowerShell)' } else { 'Unix (Bash)' })" -ForegroundColor Yellow
Write-Host ""

# Configure Git aliases
Write-Host "Configuring Git aliases..." -ForegroundColor Yellow

if ($IsWindowsPlatform) {
    # Windows PowerShell aliases
    git config alias.agog-stage "!powershell.exe -ExecutionPolicy Bypass -File .github/scripts/powershell/stage.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ git agog-stage" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to configure git agog-stage" -ForegroundColor Red
        exit 1
    }

    git config alias.agog-commit "!powershell.exe -ExecutionPolicy Bypass -File .github/scripts/powershell/commit.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ git agog-commit" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to configure git agog-commit" -ForegroundColor Red
        exit 1
    }

    git config alias.agog-setup "!powershell.exe -ExecutionPolicy Bypass -File .github/scripts/powershell/setup-commit-template.ps1"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ git agog-setup" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to configure git agog-setup" -ForegroundColor Red
        exit 1
    }
} else {
    # Unix Bash aliases
    git config alias.agog-stage "!bash .github/scripts/bash/stage.sh"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ git agog-stage" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to configure git agog-stage" -ForegroundColor Red
        exit 1
    }

    git config alias.agog-commit "!bash .github/scripts/bash/commit.sh"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ git agog-commit" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to configure git agog-commit" -ForegroundColor Red
        exit 1
    }

    git config alias.agog-setup "!bash .github/scripts/bash/setup-commit-template.sh"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ git agog-setup" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to configure git agog-setup" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "SUCCESS: Git aliases configured!" -ForegroundColor Green
Write-Host ""
Write-Host "You can now use these commands from anywhere in the repository:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  git agog-stage    - Interactive staging helper" -ForegroundColor White
Write-Host "  git agog-commit   - Interactive commit message builder" -ForegroundColor White
Write-Host "  git agog-setup    - Configure commit message template" -ForegroundColor White
Write-Host ""
Write-Host "Examples:" -ForegroundColor Yellow
Write-Host "  git agog-stage    # Opens staging menu" -ForegroundColor Gray
Write-Host "  git agog-commit   # Opens commit builder" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: These aliases are configured for this repository only." -ForegroundColor Gray
Write-Host "To use in other repositories, run this script in each repo." -ForegroundColor Gray
Write-Host ""
Write-Host "Documentation: .github/scripts/README.md" -ForegroundColor Gray

