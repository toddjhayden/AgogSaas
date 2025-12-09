#!/bin/bash
# One-time setup script for Git commit template
# Run this once per workstation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TEMPLATE_FILE="$REPO_ROOT/.gitmessage"

echo "AGOG Commit Template Setup"
echo ""

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "ERROR: Template file not found at $TEMPLATE_FILE"
    exit 1
fi

# Configure Git to use the template
git config commit.template "$TEMPLATE_FILE"

if [ $? -eq 0 ]; then
    echo "SUCCESS: Commit template configured!"
    echo ""
    echo "Now when you run 'git commit' (without -m), your editor will open"
    echo "with a pre-filled commit message template."
    echo ""
    echo "Template location: $TEMPLATE_FILE"
    echo ""
    echo "For more information, see:"
    echo "  - .github/GIT_COMMIT_GUIDE.md"
    echo "  - Standards/code/git-standards.md"
else
    echo "ERROR: Failed to configure commit template"
    exit 1
fi
