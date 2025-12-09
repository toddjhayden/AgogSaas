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
    # Skip this script itself, archives, and example files
    if [[ "$FILE" == "scripts/check-secrets.sh" ]] || \
       [[ "$FILE" == *"/archive/"* ]] || \
       [[ "$FILE" == *".example"* ]] || \
       [[ "$FILE" == *".env.example"* ]]; then
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
