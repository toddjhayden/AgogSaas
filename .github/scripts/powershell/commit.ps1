#!/usr/bin/env pwsh
# Interactive commit helper for AGOG project
# Optional tool - makes commits easier but not required

param(
    [switch]$Help,
    [string]$SuggestedScope = "",
    [string]$SuggestedSubject = "",
    [string]$FileName = ""
)

if ($Help) {
    Write-Host "AGOG Commit Helper" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\commit.ps1 [-SuggestedScope <scope>] [-SuggestedSubject <subject>] [-FileName <file>]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This script helps you create properly formatted commits."
    Write-Host "It's optional - you can also use 'git commit' directly with the template."
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -SuggestedScope    Auto-suggest a scope based on file path"
    Write-Host "  -SuggestedSubject  Auto-suggest a subject based on file name"
    Write-Host "  -FileName          The name of the file being committed (for context)"
    Write-Host ""
    Write-Host "See Standards/code/git-standards.md for details."
    exit 0
}

Write-Host "AGOG Commit Helper" -ForegroundColor Cyan
Write-Host ""

# Check for staged changes
$stagedFiles = git diff --cached --name-only
if (-not $stagedFiles) {
    Write-Host "ERROR: No staged files. Stage files first with 'git add <files>'" -ForegroundColor Red
    exit 1
}

Write-Host "Staged files:" -ForegroundColor Green
$stagedFiles | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host ""

# Type selection
Write-Host "1. Commit Type:" -ForegroundColor Yellow
Write-Host "   feat     - New feature"
Write-Host "   fix      - Bug fix"
Write-Host "   docs     - Documentation only"
Write-Host "   style    - Code style (formatting)"
Write-Host "   refactor - Code refactoring"
Write-Host "   perf     - Performance improvement"
Write-Host "   test     - Add/update tests"
Write-Host "   chore    - Maintenance, dependencies"
Write-Host "   ci       - CI/CD changes"
Write-Host ""
$type = Read-Host "Enter type"

# Validate type
$validTypes = @("feat", "fix", "docs", "style", "refactor", "perf", "test", "chore", "ci", "build", "revert")
if ($type -notin $validTypes) {
    Write-Host "ERROR: Invalid type. Must be one of: $($validTypes -join ', ')" -ForegroundColor Red
    exit 1
}

# Scope selection
Write-Host ""
Write-Host "2. Scope (optional - press Enter to skip):" -ForegroundColor Yellow
Write-Host "   Common: api, auth, customer, job, estimate, inventory, production"
Write-Host "           equipment, db, docs, standards"
if ($SuggestedScope) {
    Write-Host "   Suggested: $SuggestedScope" -ForegroundColor Cyan
}
Write-Host ""
$scopePrompt = if ($SuggestedScope) { "Enter scope (or press Enter for '$SuggestedScope')" } else { "Enter scope" }
$scope = Read-Host $scopePrompt

# Use suggested scope if user pressed Enter and we have a suggestion
if (-not $scope -and $SuggestedScope) {
    $scope = $SuggestedScope
    Write-Host "Using suggested scope: $scope" -ForegroundColor Green
}

# Subject
Write-Host ""
Write-Host "3. Subject (brief description, max 72 chars):" -ForegroundColor Yellow
Write-Host "   Use imperative mood: 'Add feature' not 'Added feature'" -ForegroundColor Gray
if ($SuggestedSubject) {
    Write-Host "   Suggested: $SuggestedSubject" -ForegroundColor Cyan
}
if ($FileName) {
    Write-Host "   File: $FileName" -ForegroundColor Gray
}
Write-Host ""
$subjectPrompt = if ($SuggestedSubject) { "Enter subject (or press Enter for '$SuggestedSubject')" } else { "Enter subject" }
$subject = Read-Host $subjectPrompt

# Use suggested subject if user pressed Enter and we have a suggestion
if (-not $subject -and $SuggestedSubject) {
    $subject = $SuggestedSubject
    Write-Host "Using suggested subject: $subject" -ForegroundColor Green
}

if ($subject.Length -gt 72) {
    Write-Host "WARNING: Subject is longer than 72 characters" -ForegroundColor Yellow
}

# Build commit message
if ($scope) {
    $commitMsg = "${type}(${scope}): ${subject}"
} else {
    $commitMsg = "${type}: ${subject}"
}

# Optional body
Write-Host ""
Write-Host "4. Body (optional - press Enter to skip):" -ForegroundColor Yellow
Write-Host "   Explain WHAT changed and WHY" -ForegroundColor Gray
Write-Host ""
$body = Read-Host "Enter body"

# Optional issue number
Write-Host ""
Write-Host "5. GitHub Issue (optional - press Enter to skip):" -ForegroundColor Yellow
Write-Host "   Example: 123 (for issue ``#123)" -ForegroundColor Gray
Write-Host ""
$issue = Read-Host "Enter issue number"

# Build full message
$fullMsg = $commitMsg
if ($body) {
    $fullMsg += "`n`n$body"
}
if ($issue) {
    $fullMsg += "`n`nCloses `#$issue"
}

# Preview
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Commit Message Preview:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host $fullMsg -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Confirm
$confirm = Read-Host "Commit with this message? (Y/n)"
if ($confirm -and $confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "CANCELLED: Commit cancelled" -ForegroundColor Red
    exit 1
}

# Commit
git commit -m $fullMsg

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS: Commit successful!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: Commit failed" -ForegroundColor Red
    exit 1
}
