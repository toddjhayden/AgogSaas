#!/bin/bash
# Setup script for Git aliases
# Run this once per repository to enable short commands

echo "Setting up Git aliases for AGOG workflow scripts..."
echo ""

# Detect platform
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    SCRIPT_PATH=".github/scripts/powershell"
    SCRIPT_EXT="ps1"
    SHELL_CMD="pwsh -File"
    PLATFORM="Windows (PowerShell)"
else
    SCRIPT_PATH=".github/scripts/bash"
    SCRIPT_EXT="sh"
    SHELL_CMD="bash"
    PLATFORM="Unix (Bash)"
fi

echo "Detected platform: $PLATFORM"
echo ""

# Configure Git aliases
echo "Configuring Git aliases..."

# Stage alias
if git config alias.agog-stage "!$SHELL_CMD $SCRIPT_PATH/stage.$SCRIPT_EXT"; then
    echo "  ✓ git agog-stage"
else
    echo "  ✗ Failed to configure git agog-stage"
    exit 1
fi

# Commit helper alias
if git config alias.agog-commit "!$SHELL_CMD $SCRIPT_PATH/commit.$SCRIPT_EXT"; then
    echo "  ✓ git agog-commit"
else
    echo "  ✗ Failed to configure git agog-commit"
    exit 1
fi

# Setup template alias
if git config alias.agog-setup "!$SHELL_CMD $SCRIPT_PATH/setup-commit-template.$SCRIPT_EXT"; then
    echo "  ✓ git agog-setup"
else
    echo "  ✗ Failed to configure git agog-setup"
    exit 1
fi

echo ""
echo "SUCCESS: Git aliases configured!"
echo ""
echo "You can now use these commands from anywhere in the repository:"
echo ""
echo "  git agog-stage    - Interactive staging helper"
echo "  git agog-commit   - Interactive commit message builder"
echo "  git agog-setup    - Configure commit message template"
echo ""
echo "Examples:"
echo "  git agog-stage    # Opens staging menu"
echo "  git agog-commit   # Opens commit builder"
echo ""
echo "Note: These aliases are configured for this repository only."
echo "To use in other repositories, run this script in each repo."
echo ""
echo "Documentation: .github/scripts/README.md"
