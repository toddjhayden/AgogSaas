# Add Navigation Paths to Markdown Files
# This script adds top and bottom navigation paths to markdown files

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$true)]
    [string]$NavigationPath,
    
    [Parameter(Mandatory=$true)]
    [string]$BottomNavigation
)

# Read the file
$content = Get-Content -Path $FilePath -Raw

# Check if navigation already exists
if ($content -match '📍 Navigation Path:') {
    Write-Host "Navigation path already exists in: $FilePath" -ForegroundColor Yellow
    return
}

# Find the first heading (# Title)
if ($content -match '^(# .+)$') {
    $title = $Matches[1]
    
    # Add top navigation before the title
    $content = $content -replace "^# ", "$NavigationPath`n`n# "
    
    # Add bottom navigation at the end (after trimming whitespace)
    $content = $content.TrimEnd()
    $content += "`n`n---`n`n$BottomNavigation`n"
    
    # Write back to file
    Set-Content -Path $FilePath -Value $content -NoNewline
    
    Write-Host "Added navigation to: $FilePath" -ForegroundColor Green
} else {
    Write-Host "Could not find title in: $FilePath" -ForegroundColor Red
}
