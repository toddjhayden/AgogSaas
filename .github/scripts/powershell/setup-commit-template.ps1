#!/usr/bin/env pwsh
# Setup Git commit template for AGOG project
# Run once per developer workstation

Write-Host "🚀 Setting up AGOG Git commit template..." -ForegroundColor Cyan

# Get repository root
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Host "❌ Not in a Git repository" -ForegroundColor Red
    exit 1
}

# Set commit template (repository-specific)
$templatePath = "$repoRoot/.gitmessage"
git config commit.template $templatePath

Write-Host "✅ Git commit template configured!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next time you run 'git commit' (without -m), your editor will open with the template pre-filled." -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Quick commit: git commit -m 'type(scope): subject'" -ForegroundColor Yellow
Write-Host "💡 Full commit:  git commit (opens editor with template)" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 See Standards/code/git-standards.md for complete guide" -ForegroundColor Cyan
