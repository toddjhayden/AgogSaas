#!/bin/bash
# Interactive staging helper for AGOG project
# Makes staging workflow easier and faster

# Helper function to suggest scope and subject based on file path
get_commit_suggestions() {
    local file_path="$1"
    local status="${2:-M}"  # M=Modified, ?=Untracked, D=Deleted, R=Renamed
    local scope=""
    local subject=""
    local file_name=$(basename "$file_path")
    
    # Determine action verb based on status
    local verb="update"
    case "$status" in
        M) verb="update" ;;
        \?) verb="add" ;;
        A) verb="add" ;;
        D) verb="remove" ;;
        R) verb="rename" ;;
    esac
    
    # Suggest scope based on file path
    if [[ "$file_path" =~ \.github/ ]]; then
        scope="git"
    elif [[ "$file_path" =~ Standards/code/ ]]; then
        scope="standards"
    elif [[ "$file_path" =~ Standards/data/ ]]; then
        scope="standards"
    elif [[ "$file_path" =~ Standards/api/ ]]; then
        scope="standards"
    elif [[ "$file_path" =~ Standards/ ]]; then
        scope="standards"
    elif [[ "$file_path" =~ "Project Architecture/" ]]; then
        scope="arch"
    elif [[ "$file_path" =~ "Project Spirit/" ]]; then
        scope="docs"
    elif [[ "$file_path" =~ Implementation/.*customer ]]; then
        scope="customer"
    elif [[ "$file_path" =~ Implementation/.*job ]]; then
        scope="job"
    elif [[ "$file_path" =~ Implementation/.*inventory ]]; then
        scope="inventory"
    elif [[ "$file_path" =~ Implementation/.*production ]]; then
        scope="production"
    elif [[ "$file_path" =~ Implementation/ ]]; then
        scope="impl"
    elif [[ "$file_path" =~ README\.md ]]; then
        scope="docs"
    elif [[ "$file_path" =~ \.md$ ]]; then
        scope="docs"
    fi
    
    # Suggest subject based on file name and status
    if [[ "$file_name" == "README.md" ]]; then
        local parent_dir=$(basename "$(dirname "$file_path")")
        subject="$verb $parent_dir README"
    elif [[ "$file_name" =~ SESSION_CONTEXT ]]; then
        subject="$verb session context"
    elif [[ "$file_name" =~ GIT_COMMIT_GUIDE ]]; then
        subject="$verb commit guide"
    elif [[ "$file_name" =~ -standards\.md$ ]]; then
        local standard_type="${file_name%-standards.md}"
        subject="$verb $standard_type standards"
    elif [[ "$file_name" =~ \.md$ ]]; then
        local base_name="${file_name%.md}"
        base_name="${base_name//-/ }"
        base_name="${base_name//_/ }"
        subject="$verb $base_name"
    else
        subject="$verb $file_name"
    fi
    
    # Return as space-separated values: scope|subject|filename
    echo "$scope|$subject|$file_name"
}

# Help text
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "AGOG Stage Helper"
    echo ""
    echo "Usage: ./stage.sh"
    echo ""
    echo "This script helps you stage files for commit."
    echo "Shows you what's changed and gives you options for staging."
    echo ""
    echo "See Standards/code/git-standards.md for details."
    exit 0
fi

echo "AGOG Stage Helper"
echo ""

# Get file status
STAGED_FILES=$(git diff --cached --name-only)
UNSTAGED_FILES=$(git diff --name-only)
UNTRACKED_FILES=$(git ls-files --others --exclude-standard)

STAGED_COUNT=$(echo "$STAGED_FILES" | grep -c '^' 2>/dev/null || echo 0)
UNSTAGED_COUNT=$(echo "$UNSTAGED_FILES" | grep -c '^' 2>/dev/null || echo 0)
UNTRACKED_COUNT=$(echo "$UNTRACKED_FILES" | grep -c '^' 2>/dev/null || echo 0)

[ -z "$STAGED_FILES" ] && STAGED_COUNT=0
[ -z "$UNSTAGED_FILES" ] && UNSTAGED_COUNT=0
[ -z "$UNTRACKED_FILES" ] && UNTRACKED_COUNT=0

# Display current status
echo "Current Status:"
echo "  Staged files:    $STAGED_COUNT"
echo "  Unstaged files:  $UNSTAGED_COUNT"
echo "  Untracked files: $UNTRACKED_COUNT"
echo ""

# If nothing to stage, show staged files and exit
if [ $UNSTAGED_COUNT -eq 0 ] && [ $UNTRACKED_COUNT -eq 0 ]; then
    if [ $STAGED_COUNT -eq 0 ]; then
        echo "No changes to stage. Working directory is clean!"
        exit 0
    else
        echo "All changes are already staged:"
        echo "$STAGED_FILES" | sed 's/^/  /'
        echo ""
        
        read -p "Run commit script now? (Y/n): " run_commit
        if [[ -z "$run_commit" || "$run_commit" == "Y" || "$run_commit" == "y" ]]; then
            exec "$(dirname "$0")/commit.sh"
        fi
        exit 0
    fi
fi

# Show what's staged (if any)
if [ $STAGED_COUNT -gt 0 ]; then
    echo "Already Staged:"
    echo "$STAGED_FILES" | sed 's/^/  /'
    echo ""
fi

# Main menu
echo "Options:"
echo "  s) Quick Session Commit    - Stage SESSION_CONTEXT.md and commit"
echo "  a) Stage All Changed Files - Stage all unstaged files"
echo "  f) Selective File Staging  - Choose which files to stage"
echo "  q) Exit                    - Return to making changes"
echo ""

read -p "Choose (s/a/f/q): " choice

case "$choice" in
    s)
        # Quick Session Commit
        echo ""
        echo "Quick Session Commit..."
        
        SESSION_FILE=".github/SESSION_CONTEXT.md"
        
        # Check if session file has changes
        if ! echo "$UNSTAGED_FILES" | grep -q "^$SESSION_FILE$"; then
            echo "ERROR: SESSION_CONTEXT.md has no changes to commit"
            exit 1
        fi
        
        # Stage the session file
        git add "$SESSION_FILE"
        echo "Staged: $SESSION_FILE"
        echo ""
        
        # Commit with standard message
        COMMIT_MSG="docs(session): Update session context with today's work"
        echo "Committing with message:"
        echo "  $COMMIT_MSG"
        echo ""
        
        git commit -m "$COMMIT_MSG"
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "SUCCESS: Session context committed!"
        else
            echo ""
            echo "ERROR: Commit failed"
            exit 1
        fi
        ;;
        
    a)
        # Stage All
        echo ""
        echo "Staging all changed files..."
        echo ""
        
        # Stage all modified files
        if [ $UNSTAGED_COUNT -gt 0 ]; then
            echo "$UNSTAGED_FILES" | while read -r file; do
                echo "  Staging: $file"
            done
            git add -u
        fi
        
        # Ask about untracked files
        if [ $UNTRACKED_COUNT -gt 0 ]; then
            echo ""
            echo "Untracked files found:"
            echo "$UNTRACKED_FILES" | sed 's/^/  /'
            echo ""
            
            read -p "Stage untracked files too? (y/N): " stage_untracked
            if [[ "$stage_untracked" == "y" || "$stage_untracked" == "Y" ]]; then
                git add .
                echo "All files staged!"
            fi
        fi
        
        echo ""
        echo "SUCCESS: Files staged!"
        echo ""
        
        # Ask to run commit script
        read -p "Run commit script now? (Y/n): " run_commit
        if [[ -z "$run_commit" || "$run_commit" == "Y" || "$run_commit" == "y" ]]; then
            exec "$(dirname "$0")/commit.sh"
        fi
        ;;
        
    f)
        # Selective Staging
        echo ""
        echo "Selective Staging Mode"
        echo ""
        echo "Files to stage:"
        echo ""
        
        # Combine and sort all files
        declare -a ALL_FILES
        INDEX=1
        
        # Add unstaged files
        while IFS= read -r file; do
            [ -z "$file" ] && continue
            ALL_FILES[$INDEX]="M:$file"
            INDEX=$((INDEX + 1))
        done <<< "$UNSTAGED_FILES"
        
        # Add untracked files
        while IFS= read -r file; do
            [ -z "$file" ] && continue
            ALL_FILES[$INDEX]="?:$file"
            INDEX=$((INDEX + 1))
        done <<< "$UNTRACKED_FILES"
        
        # Display numbered list
        for i in "${!ALL_FILES[@]}"; do
            STATUS="${ALL_FILES[$i]%%:*}"
            FILEPATH="${ALL_FILES[$i]#*:}"
            echo "  [$i] [$STATUS] $FILEPATH"
        done
        
        echo ""
        echo "Commands: [number]=stage file | 'all'=all | 'c'=commit | 'q'=quit"
        echo ""
        
        # Interactive staging loop
        while true; do
            # Check if any files left
            if [ ${#ALL_FILES[@]} -eq 0 ]; then
                echo ""
                echo "All files staged!"
                
                CURRENT_STAGED=$(git diff --cached --name-only)
                if [ -n "$CURRENT_STAGED" ]; then
                    echo ""
                    read -p "Run commit script for staged files? (Y/n): " run_commit
                    if [[ -z "$run_commit" || "$run_commit" == "Y" || "$run_commit" == "y" ]]; then
                        exec "$(dirname "$0")/commit.sh"
                    fi
                fi
                exit 0
            fi
            
            read -p "> " user_choice
            
            # Check for commands
            case "$user_choice" in
                q|quit)
                    echo "Cancelled"
                    exit 0
                    ;;
                d|done)
                    echo "Done staging!"
                    exit 0
                    ;;
                c|commit)
                    CURRENT_STAGED=$(git diff --cached --name-only)
                    if [ -z "$CURRENT_STAGED" ]; then
                        echo "ERROR: No files staged yet. Stage a file first."
                        continue
                    fi
                    
                    echo ""
                    echo "Running commit script..."
                    exec "$(dirname "$0")/commit.sh"
                    ;;
                a|all)
                    echo "Staging all files..."
                    git add .
                    echo "SUCCESS: All files staged!"
                    echo ""
                    
                    read -p "Run commit script now? (Y/n): " run_commit
                    if [[ -z "$run_commit" || "$run_commit" == "Y" || "$run_commit" == "y" ]]; then
                        exec "$(dirname "$0")/commit.sh"
                    fi
                    exit 0
                    ;;
                *)
                    # Try to parse as number
                    if [[ "$user_choice" =~ ^[0-9]+$ ]]; then
                        if [ -n "${ALL_FILES[$user_choice]}" ]; then
                            FILE_STATUS="${ALL_FILES[$user_choice]%%:*}"
                            FILEPATH="${ALL_FILES[$user_choice]#*:}"
                            git add "$FILEPATH"
                            echo "Staged: $FILEPATH"
                            
                            # Remove from array
                            unset ALL_FILES[$user_choice]
                            
                            echo ""
                            read -p "Commit this file now? (Y/n/skip): " commit_now
                            
                            if [[ "$commit_now" == "skip" || "$commit_now" == "s" ]]; then
                                echo "File staged. Choose another file or 'c' to commit all staged files."
                                continue
                            fi
                            
                            if [[ -z "$commit_now" || "$commit_now" == "Y" || "$commit_now" == "y" ]]; then
                                echo ""
                                echo "Running commit script..."
                                
                                # Get smart suggestions for single file commits
                                SUGGESTIONS=$(get_commit_suggestions "$FILEPATH" "$FILE_STATUS")
                                IFS='|' read -r SUGGESTED_SCOPE SUGGESTED_SUBJECT FILE_NAME <<< "$SUGGESTIONS"
                                
                                # Call commit script with suggestions
                                "$(dirname "$0")/commit.sh" \
                                    --scope "$SUGGESTED_SCOPE" \
                                    --subject "$SUGGESTED_SUBJECT" \
                                    --file "$FILE_NAME"
                                
                                if [ $? -eq 0 ]; then
                                    echo ""
                                    echo "Commit successful!"
                                    
                                    if [ ${#ALL_FILES[@]} -eq 0 ]; then
                                        echo "No more files to stage. Exiting."
                                        exit 0
                                    fi
                                    
                                    echo ""
                                    read -p "Stage and commit another file? (Y/n/q): " continue_staging
                                    if [[ "$continue_staging" == "q" || "$continue_staging" == "quit" ]]; then
                                        echo "Done staging!"
                                        exit 0
                                    fi
                                    if [[ -n "$continue_staging" && "$continue_staging" != "Y" && "$continue_staging" != "y" ]]; then
                                        echo "Done staging!"
                                        exit 0
                                    fi
                                    
                                    echo ""
                                    echo "Files remaining to stage:"
                                    echo ""
                                    for i in "${!ALL_FILES[@]}"; do
                                        STATUS="${ALL_FILES[$i]%%:*}"
                                        FILEPATH="${ALL_FILES[$i]#*:}"
                                        echo "  [$i] [$STATUS] $FILEPATH"
                                    done
                                    echo ""
                                    echo "Commands: [number]=stage file | 'all'=all | 'c'=commit | 'q'=quit"
                                    echo ""
                                fi
                            fi
                        else
                            echo "Invalid file number"
                        fi
                    else
                        echo "Invalid input. Enter a number or command."
                    fi
                    ;;
            esac
        done
        ;;
        
    q)
        # Exit
        echo "Exiting. No changes made."
        exit 0
        ;;
        
    *)
        echo "ERROR: Invalid choice. Please run again and select s/a/f/q."
        exit 1
        ;;
esac
