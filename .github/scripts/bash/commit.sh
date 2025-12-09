#!/bin/bash
# Interactive commit helper for AGOG project
# Optional tool - makes commits easier but not required

# Parse command line arguments
SUGGESTED_SCOPE=""
SUGGESTED_SUBJECT=""
FILE_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "AGOG Commit Helper"
            echo ""
            echo "Usage: ./commit.sh [--scope <scope>] [--subject <subject>] [--file <filename>]"
            echo ""
            echo "This script helps you create properly formatted commits."
            echo "It's optional - you can also use 'git commit' directly with the template."
            echo ""
            echo "Parameters:"
            echo "  --scope    Auto-suggest a scope based on file path"
            echo "  --subject  Auto-suggest a subject based on file name"
            echo "  --file     The name of the file being committed (for context)"
            echo ""
            echo "See Standards/code/git-standards.md for details."
            exit 0
            ;;
        --scope)
            SUGGESTED_SCOPE="$2"
            shift 2
            ;;
        --subject)
            SUGGESTED_SUBJECT="$2"
            shift 2
            ;;
        --file)
            FILE_NAME="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo "AGOG Commit Helper"
echo ""

# Check for staged changes
STAGED_FILES=$(git diff --cached --name-only)
if [ -z "$STAGED_FILES" ]; then
    echo "ERROR: No staged files. Stage files first with 'git add <files>'"
    exit 1
fi

echo "Staged files:"
echo "$STAGED_FILES" | sed 's/^/   /'
echo ""

# Type selection
echo "1. Commit Type:"
echo "   feat     - New feature"
echo "   fix      - Bug fix"
echo "   docs     - Documentation only"
echo "   style    - Code style (formatting)"
echo "   refactor - Code refactoring"
echo "   perf     - Performance improvement"
echo "   test     - Add/update tests"
echo "   chore    - Maintenance, dependencies"
echo "   ci       - CI/CD changes"
echo ""
read -p "Enter type: " type

# Validate type
VALID_TYPES="feat fix docs style refactor perf test chore ci build revert"
if ! echo "$VALID_TYPES" | grep -w "$type" > /dev/null; then
    echo "ERROR: Invalid type. Must be one of: $VALID_TYPES"
    exit 1
fi

# Scope selection
echo ""
echo "2. Scope (optional - press Enter to skip):"
echo "   Common: api, auth, customer, job, estimate, inventory, production"
echo "           equipment, db, docs, standards"
if [ -n "$SUGGESTED_SCOPE" ]; then
    echo "   Suggested: $SUGGESTED_SCOPE"
fi
echo ""
if [ -n "$SUGGESTED_SCOPE" ]; then
    read -p "Enter scope (or press Enter for '$SUGGESTED_SCOPE'): " scope
else
    read -p "Enter scope: " scope
fi

# Use suggested scope if user pressed Enter and we have a suggestion
if [ -z "$scope" ] && [ -n "$SUGGESTED_SCOPE" ]; then
    scope="$SUGGESTED_SCOPE"
    echo "Using suggested scope: $scope"
fi

# Subject
echo ""
echo "3. Subject (brief description, max 72 chars):"
echo "   Use imperative mood: 'Add feature' not 'Added feature'"
if [ -n "$SUGGESTED_SUBJECT" ]; then
    echo "   Suggested: $SUGGESTED_SUBJECT"
fi
if [ -n "$FILE_NAME" ]; then
    echo "   File: $FILE_NAME"
fi
echo ""
if [ -n "$SUGGESTED_SUBJECT" ]; then
    read -p "Enter subject (or press Enter for '$SUGGESTED_SUBJECT'): " subject
else
    read -p "Enter subject: " subject
fi

# Use suggested subject if user pressed Enter and we have a suggestion
if [ -z "$subject" ] && [ -n "$SUGGESTED_SUBJECT" ]; then
    subject="$SUGGESTED_SUBJECT"
    echo "Using suggested subject: $subject"
fi

if [ ${#subject} -gt 72 ]; then
    echo "WARNING: Subject is longer than 72 characters"
fi

# Build commit message
if [ -n "$scope" ]; then
    COMMIT_MSG="${type}(${scope}): ${subject}"
else
    COMMIT_MSG="${type}: ${subject}"
fi

# Optional body
echo ""
echo "4. Body (optional - press Enter to skip):"
echo "   Explain WHAT changed and WHY"
echo ""
read -p "Enter body: " body

# Optional issue number
echo ""
echo "5. GitHub Issue (optional - press Enter to skip):"
echo "   Example: 123 (for issue #123)"
echo ""
read -p "Enter issue number: " issue

# Build full message
FULL_MSG="$COMMIT_MSG"
if [ -n "$body" ]; then
    FULL_MSG="$FULL_MSG

$body"
fi
if [ -n "$issue" ]; then
    FULL_MSG="$FULL_MSG

Closes #$issue"
fi

# Preview
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Commit Message Preview:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$FULL_MSG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Confirm
read -p "Commit with this message? (Y/n): " confirm
if [[ -n "$confirm" && "$confirm" != "Y" && "$confirm" != "y" ]]; then
    echo "CANCELLED: Commit cancelled"
    exit 1
fi

# Commit
git commit -m "$FULL_MSG"

if [ $? -eq 0 ]; then
    echo ""
    echo "SUCCESS: Commit successful!"
else
    echo ""
    echo "ERROR: Commit failed"
    exit 1
fi
