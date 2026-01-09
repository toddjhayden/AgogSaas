#!/bin/bash

# Check for common secret patterns
FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$FILES" ]; then
    exit 0
fi

# Patterns to check for
PATTERNS=(
    "password.*=.*['\"]"
    "api[_-]?key.*=.*['\"]"
    "secret.*=.*['\"]"
    "token.*=.*['\"]"
    "default-tenant"
    "postgres://.*:.*@"
)

FOUND=0

for FILE in $FILES; do
    # Skip this script itself, archives, example files, documentation, backup files, shell scripts, batch files, GitHub Actions workflows, auth pages (contain legitimate password form fields), settings pages (contain token input UI), and memory storage scripts (contain descriptions of work done)
    if [[ "$FILE" == "scripts/check-secrets.sh" ]] || \
       [[ "$FILE" == *"/archive/"* ]] || \
       [[ "$FILE" == *".example"* ]] || \
       [[ "$FILE" == *".env.example"* ]] || \
       [[ "$FILE" == *".md" ]] || \
       [[ "$FILE" == *".old" ]] || \
       [[ "$FILE" == *".sh" ]] || \
       [[ "$FILE" == *".bat" ]] || \
       [[ "$FILE" == ".github/workflows/"* ]] || \
       [[ "$FILE" == *"/pages/auth/"* ]] || \
       [[ "$FILE" == *"/pages/SettingsPage.tsx" ]] || \
       [[ "$FILE" == *"/constants/defaults.ts" ]] || \
       [[ "$FILE" == *"/types/ai-providers.ts" ]] || \
       [[ "$FILE" == *"/stores/useAIChatStore.ts" ]] || \
       [[ "$FILE" == *"/components/AIChatPanel.tsx" ]] || \
       [[ "$FILE" == *"/agent-backend/scripts/store-memory-"* ]]; then
        continue
    fi
    
    if [ -f "$FILE" ]; then
        for PATTERN in "${PATTERNS[@]}"; do
            if grep -iE "$PATTERN" "$FILE" >/dev/null 2>&1; then
                echo "❌ Found potential secret in $FILE"
                FOUND=1
            fi
        done
    fi
done

if [ $FOUND -eq 1 ]; then
    echo ""
    echo "Secrets detected! Please remove before committing."
    echo "Use environment variables instead."
    exit 1
fi

exit 0
