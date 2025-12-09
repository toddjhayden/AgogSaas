#!/usr/bin/env pwsh
# Interactive staging helper for AGOG project
# Makes staging workflow easier and faster

param(
    [switch]$Help
)

if ($Help) {
    Write-Host "AGOG Stage Helper" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\stage.ps1" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This script helps you stage files for commit."
    Write-Host "Shows you what's changed and gives you options for staging."
    Write-Host ""
    Write-Host "See Standards/code/git-standards.md for details."
    exit 0
}

# Helper function to suggest scope and subject based on file path
function Get-CommitSuggestions {
    param(
        [string]$FilePath,
        [string]$Status = "M"  # M=Modified, A=Added, D=Deleted, ?=Untracked
    )
    
    $scope = ""
    $subject = ""
    $fileName = Split-Path $FilePath -Leaf
    
    # Determine action verb based on status
    $verb = switch ($Status) {
        "M" { "update" }
        "?" { "add" }
        "A" { "add" }
        "D" { "remove" }
        "R" { "rename" }
        default { "update" }
    }
    
    # Suggest scope based on file path
    if ($FilePath -match "\.github/") {
        $scope = "git"
    } elseif ($FilePath -match "Standards/code/") {
        $scope = "standards"
    } elseif ($FilePath -match "Standards/data/") {
        $scope = "standards"
    } elseif ($FilePath -match "Standards/api/") {
        $scope = "standards"
    } elseif ($FilePath -match "Standards/") {
        $scope = "standards"
    } elseif ($FilePath -match "Project Architecture/") {
        $scope = "arch"
    } elseif ($FilePath -match "Project Spirit/") {
        $scope = "docs"
    } elseif ($FilePath -match "Implementation/.*customer") {
        $scope = "customer"
    } elseif ($FilePath -match "Implementation/.*job") {
        $scope = "job"
    } elseif ($FilePath -match "Implementation/.*inventory") {
        $scope = "inventory"
    } elseif ($FilePath -match "Implementation/.*production") {
        $scope = "production"
    } elseif ($FilePath -match "Implementation/") {
        $scope = "impl"
    } elseif ($FilePath -match "README\.md") {
        $scope = "docs"
    } elseif ($FilePath -match "\.md$") {
        $scope = "docs"
    }
    
    # Suggest subject based on file name and status
    if ($fileName -eq "README.md") {
        $parentDir = Split-Path (Split-Path $FilePath -Parent) -Leaf
        $subject = "$verb $parentDir README"
    } elseif ($fileName -match "SESSION_CONTEXT") {
        $subject = "$verb session context"
    } elseif ($fileName -match "GIT_COMMIT_GUIDE") {
        $subject = "$verb commit guide"
    } elseif ($fileName -match "-standards\.md$") {
        $standardType = $fileName -replace "-standards\.md$", ""
        $subject = "$verb $standardType standards"
    } elseif ($fileName -match "\.md$") {
        $baseName = $fileName -replace "\.md$", "" -replace "-", " " -replace "_", " "
        $subject = "$verb $baseName"
    } else {
        $subject = "$verb $fileName"
    }
    
    return @{
        Scope = $scope
        Subject = $subject
        FileName = $fileName
    }
}

Write-Host "AGOG Stage Helper" -ForegroundColor Cyan
Write-Host ""

# Get file status
$stagedFiles = git diff --cached --name-only
$unstagedFiles = git diff --name-only
$untrackedFiles = git ls-files --others --exclude-standard

$stagedCount = if ($stagedFiles) { ($stagedFiles | Measure-Object).Count } else { 0 }
$unstagedCount = if ($unstagedFiles) { ($unstagedFiles | Measure-Object).Count } else { 0 }
$untrackedCount = if ($untrackedFiles) { ($untrackedFiles | Measure-Object).Count } else { 0 }

# Display current status
Write-Host "Current Status:" -ForegroundColor Yellow
Write-Host "  Staged files:    $stagedCount" -ForegroundColor Green
Write-Host "  Unstaged files:  $unstagedCount" -ForegroundColor Yellow
Write-Host "  Untracked files: $untrackedCount" -ForegroundColor Gray
Write-Host ""

# If nothing to stage, show staged files and exit
if ($unstagedCount -eq 0 -and $untrackedCount -eq 0) {
    if ($stagedCount -eq 0) {
        Write-Host "No changes to stage. Working directory is clean!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "All changes are already staged:" -ForegroundColor Green
        $stagedFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
        Write-Host ""
        
        $runCommit = Read-Host "Run commit script now? (Y/n)"
        if (-not $runCommit -or $runCommit -eq "Y" -or $runCommit -eq "y") {
            & "$PSScriptRoot\commit.ps1"
        }
        exit 0
    }
}

# Show what's staged (if any)
if ($stagedCount -gt 0) {
    Write-Host "Already Staged:" -ForegroundColor Green
    $stagedFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
    Write-Host ""
}

# Main menu
Write-Host "Options:" -ForegroundColor Yellow
Write-Host "  s) Quick Session Commit    - Stage SESSION_CONTEXT.md and commit" -ForegroundColor Cyan
Write-Host "  a) Stage All Changed Files - Stage all unstaged files" -ForegroundColor Cyan
Write-Host "  f) Selective File Staging  - Choose which files to stage" -ForegroundColor Cyan
Write-Host "  q) Exit                    - Return to making changes" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Choose (s/a/f/q)"

switch ($choice) {
    "s" {
        # Quick Session Commit
        Write-Host ""
        Write-Host "Quick Session Commit..." -ForegroundColor Cyan
        
        $sessionFile = ".github/SESSION_CONTEXT.md"
        
        # Check if session file has changes
        $sessionChanged = $false
        if ($unstagedFiles -contains $sessionFile) {
            $sessionChanged = $true
        }
        
        if (-not $sessionChanged) {
            Write-Host "ERROR: SESSION_CONTEXT.md has no changes to commit" -ForegroundColor Red
            exit 1
        }
        
        # Stage the session file
        git add $sessionFile
        Write-Host "Staged: $sessionFile" -ForegroundColor Green
        Write-Host ""
        
        # Commit with standard message
        $commitMsg = "docs(session): Update session context with today's work"
        Write-Host "Committing with message:" -ForegroundColor Yellow
        Write-Host "  $commitMsg" -ForegroundColor White
        Write-Host ""
        
        git commit -m $commitMsg
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "SUCCESS: Session context committed!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "ERROR: Commit failed" -ForegroundColor Red
            exit 1
        }
    }
    
    "a" {
        # Stage All
        Write-Host ""
        Write-Host "Staging all changed files..." -ForegroundColor Cyan
        Write-Host ""
        
        # Stage all modified files
        if ($unstagedCount -gt 0) {
            $unstagedFiles | ForEach-Object { 
                Write-Host "  Staging: $_" -ForegroundColor Green
            }
            git add -u
        }
        
        # Ask about untracked files
        if ($untrackedCount -gt 0) {
            Write-Host ""
            Write-Host "Untracked files found:" -ForegroundColor Yellow
            $untrackedFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
            Write-Host ""
            
            $stageUntracked = Read-Host "Stage untracked files too? (y/N)"
            if ($stageUntracked -eq "y" -or $stageUntracked -eq "Y") {
                git add .
                Write-Host "All files staged!" -ForegroundColor Green
            }
        }
        
        Write-Host ""
        Write-Host "SUCCESS: Files staged!" -ForegroundColor Green
        Write-Host ""
        
        # Ask to run commit script
        $runCommit = Read-Host "Run commit script now? (Y/n)"
        if (-not $runCommit -or $runCommit -eq "Y" -or $runCommit -eq "y") {
            & "$PSScriptRoot\commit.ps1"
        }
    }
    
    "f" {
        # Selective Staging
        Write-Host ""
        Write-Host "Selective Staging Mode" -ForegroundColor Cyan
        Write-Host ""
        
        # Combine and sort all files
        $allFiles = @()
        if ($unstagedFiles) { $allFiles += $unstagedFiles | ForEach-Object { @{Path=$_; Status="Modified"} } }
        if ($untrackedFiles) { $allFiles += $untrackedFiles | ForEach-Object { @{Path=$_; Status="Untracked"} } }
        
        # Sort by folder then filename
        $sortedFiles = $allFiles | Sort-Object { Split-Path $_.Path -Parent }, { Split-Path $_.Path -Leaf }
        
        # Display numbered list
        Write-Host "Files to stage:" -ForegroundColor Yellow
        Write-Host ""
        
        $index = 1
        $fileMap = @{}
        $fileStatus = @{}
        
        foreach ($file in $sortedFiles) {
            $fileMap[$index] = $file.Path
            $status = if ($file.Status -eq "Modified") { "M" } else { "?" }
            $fileStatus[$index] = $status
            $color = if ($file.Status -eq "Modified") { "Yellow" } else { "Gray" }
            
            Write-Host "  [$index] " -NoNewline -ForegroundColor Cyan
            Write-Host "[$status] " -NoNewline -ForegroundColor $color
            Write-Host "$($file.Path)" -ForegroundColor White
            
            $index++
        }
        
        Write-Host ""
        Write-Host "Commands: " -NoNewline -ForegroundColor Yellow
        Write-Host "[number]" -NoNewline -ForegroundColor Cyan
        Write-Host "=stage file | " -NoNewline -ForegroundColor Yellow
        Write-Host "'all'" -NoNewline -ForegroundColor Cyan
        Write-Host "=all | " -NoNewline -ForegroundColor Yellow
        Write-Host "'c'" -NoNewline -ForegroundColor Cyan
        Write-Host "=commit | " -NoNewline -ForegroundColor Yellow
        Write-Host "'q'" -NoNewline -ForegroundColor Cyan
        Write-Host "=quit" -ForegroundColor Yellow
        Write-Host ""
        
        # Interactive staging loop
        while ($true) {
            # Check if any files left to stage
            if ($fileMap.Count -eq 0) {
                Write-Host ""
                Write-Host "All files staged!" -ForegroundColor Green
                
                # Check if anything is staged
                $currentStaged = git diff --cached --name-only
                if ($currentStaged) {
                    Write-Host ""
                    $runCommit = Read-Host "Run commit script for staged files? (Y/n)"
                    if (-not $runCommit -or $runCommit -eq "Y" -or $runCommit -eq "y") {
                        & "$PSScriptRoot\commit.ps1"
                    }
                }
                exit 0
            }
            
            $userChoice = Read-Host ">"
            
            # Check for commands
            if ($userChoice -eq "q" -or $userChoice -eq "quit") {
                Write-Host "Cancelled" -ForegroundColor Yellow
                exit 0
            }
            
            if ($userChoice -eq "d" -or $userChoice -eq "done") {
                Write-Host "Done staging!" -ForegroundColor Green
                exit 0
            }
            
            if ($userChoice -eq "c" -or $userChoice -eq "commit") {
                # Check if anything is staged
                $currentStaged = git diff --cached --name-only
                if (-not $currentStaged) {
                    Write-Host "ERROR: No files staged yet. Stage a file first." -ForegroundColor Red
                    continue
                }
                
                Write-Host ""
                Write-Host "Running commit script..." -ForegroundColor Cyan
                & "$PSScriptRoot\commit.ps1"
                
                # After commit, check if we should continue
                if ($LASTEXITCODE -eq 0) {
                    Write-Host ""
                    Write-Host "Commit successful!" -ForegroundColor Green
                    
                    # Refresh file list (some may have been committed)
                    $remainingUnstaged = git diff --name-only
                    $remainingUntracked = git ls-files --others --exclude-standard
                    
                    if (-not $remainingUnstaged -and -not $remainingUntracked) {
                        Write-Host "No more files to stage. Exiting." -ForegroundColor Green
                        exit 0
                    }
                    
                    Write-Host ""
                    $continue = Read-Host "Stage and commit another file? (Y/n)"
                    if ($continue -and $continue -ne "Y" -and $continue -ne "y") {
                        Write-Host "Done staging!" -ForegroundColor Green
                        exit 0
                    }
                    
                    # Restart the selective staging process
                    Write-Host ""
                    Write-Host "Refreshing file list..." -ForegroundColor Cyan
                    & "$PSScriptRoot\stage.ps1"
                    exit 0
                } else {
                    Write-Host ""
                    Write-Host "ERROR: Commit failed or was cancelled" -ForegroundColor Red
                    $continue = Read-Host "Continue staging? (Y/n)"
                    if ($continue -and $continue -ne "Y" -and $continue -ne "y") {
                        exit 1
                    }
                }
                continue
            }
            
            if ($userChoice -eq "a" -or $userChoice -eq "all") {
                Write-Host "Staging all files..." -ForegroundColor Cyan
                git add .
                Write-Host "SUCCESS: All files staged!" -ForegroundColor Green
                Write-Host ""
                
                $runCommit = Read-Host "Run commit script now? (Y/n)"
                if (-not $runCommit -or $runCommit -eq "Y" -or $runCommit -eq "y") {
                    & "$PSScriptRoot\commit.ps1"
                }
                exit 0
            }
            
            # Try to parse as number
            $fileNumber = 0
            if ([int]::TryParse($userChoice, [ref]$fileNumber)) {
                if ($fileMap.ContainsKey($fileNumber)) {
                    $filePath = $fileMap[$fileNumber]
                    git add $filePath
                    Write-Host "Staged: $filePath" -ForegroundColor Green
                    
                    # Remove from map
                    $fileMap.Remove($fileNumber)
                    
                    # Ask if user wants to commit this file now
                    Write-Host ""
                    $commitNow = Read-Host "Commit this file now? (Y/n/skip)"
                    
                    if ($commitNow -eq "skip" -or $commitNow -eq "s") {
                        Write-Host "File staged. Choose another file or 'c' to commit all staged files." -ForegroundColor Yellow
                        continue
                    }
                    
                    if (-not $commitNow -or $commitNow -eq "Y" -or $commitNow -eq "y") {
                        Write-Host ""
                        Write-Host "Running commit script..." -ForegroundColor Cyan
                        
                        # Get smart suggestions for single file commits
                        $status = $fileStatus[$fileNumber]
                        $suggestions = Get-CommitSuggestions -FilePath $filePath -Status $status
                        
                        # Call commit script with suggestions
                        & "$PSScriptRoot\commit.ps1" `
                            -SuggestedScope $suggestions.Scope `
                            -SuggestedSubject $suggestions.Subject `
                            -FileName $suggestions.FileName
                        
                        # After commit, check if we should continue
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host ""
                            Write-Host "Commit successful!" -ForegroundColor Green
                            
                            if ($fileMap.Count -eq 0) {
                                Write-Host "No more files to stage. Exiting." -ForegroundColor Green
                                exit 0
                            }
                            
                            Write-Host ""
                            $continue = Read-Host "Stage and commit another file? (Y/n/q)"
                            if ($continue -eq "q" -or $continue -eq "quit") {
                                Write-Host "Done staging!" -ForegroundColor Green
                                exit 0
                            }
                            if ($continue -and $continue -ne "Y" -and $continue -ne "y") {
                                Write-Host "Done staging!" -ForegroundColor Green
                                exit 0
                            }
                            
                            Write-Host ""
                            Write-Host "Files remaining to stage:" -ForegroundColor Yellow
                            Write-Host ""
                            
                            # Re-display remaining files
                            foreach ($key in ($fileMap.Keys | Sort-Object)) {
                                $file = $fileMap[$key]
                                # Determine status
                                $status = if ($unstagedFiles -contains $file) { "M" } else { "?" }
                                $color = if ($status -eq "M") { "Yellow" } else { "Gray" }
                                
                                Write-Host "  [$key] " -NoNewline -ForegroundColor Cyan
                                Write-Host "[$status] " -NoNewline -ForegroundColor $color
                                Write-Host "$file" -ForegroundColor White
                            }
                            Write-Host ""
                            Write-Host "Commands: " -NoNewline -ForegroundColor Yellow
                            Write-Host "[number]" -NoNewline -ForegroundColor Cyan
                            Write-Host "=stage file | " -NoNewline -ForegroundColor Yellow
                            Write-Host "'all'" -NoNewline -ForegroundColor Cyan
                            Write-Host "=all | " -NoNewline -ForegroundColor Yellow
                            Write-Host "'c'" -NoNewline -ForegroundColor Cyan
                            Write-Host "=commit | " -NoNewline -ForegroundColor Yellow
                            Write-Host "'q'" -NoNewline -ForegroundColor Cyan
                            Write-Host "=quit" -ForegroundColor Yellow
                            Write-Host ""
                        } else {
                            Write-Host ""
                            Write-Host "ERROR: Commit failed or was cancelled" -ForegroundColor Red
                            $continue = Read-Host "Continue staging? (Y/n)"
                            if ($continue -and $continue -ne "Y" -and $continue -ne "y") {
                                exit 1
                            }
                        }
                    }
                } else {
                    Write-Host "Invalid file number" -ForegroundColor Red
                }
            } else {
                Write-Host "Invalid input. Enter a number or command." -ForegroundColor Red
            }
        }
    }
    
    "q" {
        # Exit
        Write-Host "Exiting. No changes made." -ForegroundColor Yellow
        exit 0
    }
    
    default {
        Write-Host "ERROR: Invalid choice. Please run again and select s/a/f/q." -ForegroundColor Red
        exit 1
    }
}
