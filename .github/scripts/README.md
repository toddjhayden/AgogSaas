**📍 Navigation Path:** [AGOG Home](../../README.md) → [.github](..) → Scripts

# Git Workflow Scripts

> **Quick Start:** Choose your platform below and follow the instructions.

---

## Quick Setup (Recommended)

**Make commands easier to type!** Run the setup script once:

### Windows (PowerShell)
```powershell
.\.github\scripts\setup-git-aliases.ps1
```

### Linux / macOS (Bash)
```bash
chmod +x .github/scripts/setup-git-aliases.sh
./.github/scripts/setup-git-aliases.sh
```

**After setup, use short commands:**
```bash
git agog-stage     # Instead of .\.github\scripts\powershell\stage.ps1
git agog-commit    # Instead of .\.github\scripts\powershell\commit.ps1
git agog-setup     # Instead of .\.github\scripts\powershell\setup-commit-template.ps1
```

These aliases work from anywhere in the repository!

---

## Choose Your Platform

### 🪟 Windows (PowerShell)

**Location:** ``.github/scripts/powershell/``

**Scripts:**
- ``stage.ps1`` - Interactive staging helper
- ``commit.ps1`` - Interactive commit builder
- ``setup-commit-template.ps1`` - One-time template setup

**Usage:**
```powershell
# Stage and commit
.\.github\scripts\powershell\stage.ps1

# Or commit pre-staged files
.\.github\scripts\powershell\commit.ps1
```

**[Full PowerShell Documentation →](./powershell/README.md)**

---

### 🐧 Linux / 🍎 macOS (Bash)

**Location:** ``.github/scripts/bash/``

**Scripts:**
- ``stage.sh`` - Interactive staging helper
- ``commit.sh`` - Interactive commit builder  
- ``setup-commit-template.sh`` - One-time template setup

**First Time Setup:**
```bash
# Make scripts executable
chmod +x .github/scripts/bash/*.sh
```

**Usage:**
```bash
# Stage and commit
./.github/scripts/bash/stage.sh

# Or commit pre-staged files
./.github/scripts/bash/commit.sh
```

**[Full Bash Documentation →](./bash/README.md)**

---

## What These Scripts Do

All scripts follow the same workflow and produce identical commit messages, regardless of platform:

✅ **Interactive prompts** - Guide you through proper commit format  
✅ **Validation** - Catch errors before committing  
✅ **Preview** - See your commit message before confirming  
✅ **Conventional Commits** - Enforces standardized format

**Common Features:**
- Quick session commit (auto-stage SESSION_CONTEXT.md)
- Batch staging (stage all files at once)
- Selective staging (choose files, commit one at a time)
- Smart loop workflow (stage → commit → stage next)

---

## Quick Reference

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Example:**
```
feat(api): add customer search endpoint

Implements fuzzy search on customer name and email.
Uses PostgreSQL full-text search for performance.

Closes #456
```

### Commit Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Tests |
| `chore` | Maintenance, dependencies |
| `ci` | CI/CD changes |

### Common Scopes

`api`, `auth`, `customer`, `job`, `estimate`, `inventory`, `production`, `equipment`, `db`, `docs`, `standards`, `tools`, `session`

---

## Platform-Specific Documentation

For detailed documentation including:
- Script reference with all options
- Common workflows and examples
- Troubleshooting guides
- Design philosophy

**Choose your platform:**
- **[PowerShell (Windows) Documentation](./powershell/README.md)**
- **[Bash (Linux/Mac) Documentation](./bash/README.md)**

---

## Cross-Platform Compatibility

Both PowerShell and Bash scripts:
- ✅ Produce identical commit messages
- ✅ Follow the same workflow
- ✅ Support the same features
- ✅ Use the same Git standards

You can switch between platforms without relearning the workflow.

---

## Related Documentation

- **[Git Standards](../../Standards/code/git-standards.md)** - Complete Git workflow documentation
- **[Commit Guide](../GIT_COMMIT_GUIDE.md)** - Quick start guide for team members
- **[Conventional Commits](https://www.conventionalcommits.org/)** - Official specification

---

[⬆ Back to top](#git-workflow-scripts) | [🏠 AGOG Home](../../README.md) | [📁 .github](../)

---

## Overview

These scripts make it easy to follow the AGOG Git standards (defined in [Standards/code/git-standards.md](../../Standards/code/git-standards.md)) without memorizing commit message formats or typing long commands.

**Available Scripts:**
- **`stage.ps1`** - Interactive staging helper with smart workflows
- **`commit.ps1`** - Interactive commit message builder
- **`setup-commit-template.ps1`** - One-time setup for commit template

---

## Quick Start

### First Time Setup (Optional)

Configure Git to use the commit message template:

```powershell
.\.github\scripts\setup-commit-template.ps1
```

This is optional but makes commits easier by pre-filling the format in your editor.

### Daily Workflow

**Option 1: Use the Stage Script (Recommended)**

```powershell
.\.github\scripts\stage.ps1
```

This script handles both staging AND committing with a smart menu system.

**Option 2: Stage Manually, Then Commit**

```powershell
git add <files>
.\.github\scripts\commit.ps1
```

---

## Script Reference

### `stage.ps1` - Interactive Staging Helper

**Purpose:** Smart staging workflow with multiple options for different scenarios.

**Usage:**
```powershell
.\.github\scripts\stage.ps1
```

**Features:**

#### Main Menu Options

**s) Quick Session Commit**
- Automatically stages `.github/SESSION_CONTEXT.md`
- Commits with standard message: `"docs(session): Update session context with today's work"`
- Perfect for end-of-day session updates
- Fast and zero-thought required

```
Example:
Choose (s/a/f/q): s
✓ Staged: .github/SESSION_CONTEXT.md
✓ Committed with standard message
```

**a) Stage All Changed Files**
- Stages all modified files at once
- Asks if you want to include untracked files
- Offers to run commit script after staging
- Good for batch commits of related changes

```
Example:
Choose (s/a/f/q): a
✓ All modified files staged
Run commit script now? Y
[commit.ps1 runs]
```

**f) Selective File Staging**
- List all changed files with numbers
- Stage and commit files one at a time
- Supports clean one-file-per-commit workflow
- Loop continues until done

```
Example:
Choose (s/a/f/q): f

Files to stage:
  [1] [M] .github/SESSION_CONTEXT.md
  [2] [M] .github/scripts/stage.ps1
  [3] [?] new-feature.md

> 1
Staged: .github/SESSION_CONTEXT.md
Commit this file now? (Y/n/skip): Y
[commit.ps1 runs]

Stage and commit another file? Y

> 2
...
```

**Commands in Selective Mode:**
- **Enter number** - Stage that file
- **`all`** - Stage all remaining files
- **`c`** or **`commit`** - Commit currently staged files
- **`d`** or **`done`** - Exit (keeps files staged)
- **`q`** or **`quit`** - Cancel and exit

**File Status Indicators:**
- **[M]** - Modified file
- **[?]** - Untracked (new) file

**q) Exit**
- Return to making changes without staging anything

---

### `commit.ps1` - Interactive Commit Message Builder

**Purpose:** Build properly formatted commit messages that follow Conventional Commits standard.

**Prerequisites:** Must have files staged (`git add <files>` or use `stage.ps1`)

**Usage:**
```powershell
.\.github\scripts\commit.ps1
```

**Workflow:**

1. **Shows staged files** - Confirms what you're about to commit
2. **Prompts for type** - feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
3. **Prompts for scope** (optional) - api, db, ui, docs, etc.
4. **Prompts for subject** - Brief description (max 72 chars)
5. **Prompts for body** (optional) - Detailed explanation
6. **Prompts for issue** (optional) - GitHub issue number
7. **Shows preview** - Full commit message
8. **Asks for confirmation** - Y to commit, n to cancel

**Example Session:**

```powershell
PS> .\.github\scripts\commit.ps1

AGOG Commit Helper

Staged files:
   .github/scripts/stage.ps1

1. Commit Type:
   feat     - New feature
   fix      - Bug fix
   docs     - Documentation only
   ...

Enter type: feat

2. Scope (optional - press Enter to skip):
   Common: api, auth, customer, job, ...

Enter scope: tools

3. Subject (brief description, max 72 chars):
   Use imperative mood: 'Add feature' not 'Added feature'

Enter subject: add interactive staging helper script

4. Body (optional - press Enter to skip):
   Explain WHAT changed and WHY

Enter body: Creates smart staging workflow with three modes

5. GitHub Issue (optional - press Enter to skip):
   Example: 123 (for issue #123)

Enter issue number: 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commit Message Preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
feat(tools): add interactive staging helper script

Creates smart staging workflow with three modes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commit with this message? (Y/n): Y

SUCCESS: Commit successful!
```

---

### `setup-commit-template.ps1` - One-Time Setup

**Purpose:** Configure Git to use the commit message template.

**Usage (Run Once):**
```powershell
.\.github\scripts\setup-commit-template.ps1
```

**What It Does:**
- Configures `git config commit.template .gitmessage`
- When you run `git commit` (without `-m`), your editor opens with pre-filled format
- Template includes examples and tips

**After Setup, Use Template:**
```powershell
git add <files>
git commit  # Opens editor with template
```

**Template Format:**
```
# type(scope): subject
# |<----  Use a maximum of 72 characters  ---->|

# Explain what changed and why (not how)
# Wrap body at 72 characters

# If this closes an issue:
# Closes #123

# Example:
# feat(api): add customer search endpoint
#
# Implements fuzzy search on customer name and email.
# Uses PostgreSQL full-text search for performance.
#
# Closes #456
```

---

## Commit Message Format

All scripts follow the **Conventional Commits** standard:

```
type(scope): subject

body (optional)

footer (optional)
```

### Type (Required)

Choose the type that best describes your change:

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(api): add customer search endpoint` |
| `fix` | Bug fix | `fix(auth): resolve token expiration issue` |
| `docs` | Documentation only | `docs(readme): update installation steps` |
| `style` | Code style (formatting, no logic change) | `style(api): fix indentation` |
| `refactor` | Code refactoring | `refactor(db): simplify query builder` |
| `perf` | Performance improvement | `perf(inventory): optimize lot lookup` |
| `test` | Add/update tests | `test(customer): add validation tests` |
| `chore` | Maintenance, dependencies | `chore(deps): update express to 4.18` |
| `ci` | CI/CD changes | `ci(github): add test workflow` |
| `build` | Build system changes | `build(webpack): update config` |
| `revert` | Revert previous commit | `revert: revert "feat(api): add endpoint"` |

### Scope (Optional)

Indicates what part of the codebase changed:

**Common Scopes:**
- `api` - API endpoints
- `auth` - Authentication/authorization
- `customer` - Customer module
- `job` - Job management
- `estimate` - Estimating system
- `inventory` - Inventory/materials
- `production` - Production/manufacturing
- `equipment` - Equipment/machines
- `db` - Database changes
- `docs` - Documentation
- `standards` - Standards/guidelines
- `tools` - Scripts/utilities
- `session` - Session context updates

### Subject (Required)

- **Max 72 characters**
- **Lowercase** (no capital first letter)
- **Imperative mood** ("add" not "added")
- **No period** at the end

✅ Good: `add customer search endpoint`  
❌ Bad: `Added customer search endpoint.`

### Body (Optional)

- Explain **WHAT** changed and **WHY** (not how)
- Wrap lines at 72 characters
- Use blank line to separate from subject
- Use bullet points for multiple items

### Footer (Optional)

- **Issue references:** `Closes #123` or `Fixes #456`
- **Breaking changes:** `BREAKING CHANGE: removed legacy API`
- **Related:** `Related: #789`

---

## Common Workflows

### Scenario 1: End of Session Update

```powershell
# Quick session commit (stages SESSION_CONTEXT.md automatically)
.\.github\scripts\stage.ps1
# Choose 's'
```

### Scenario 2: Multiple Files, One Commit

```powershell
# Stage all files and commit together
.\.github\scripts\stage.ps1
# Choose 'a' (Stage All)
# Commit script runs automatically
```

### Scenario 3: Clean Commit History (One File per Commit)

```powershell
# Stage and commit files one at a time
.\.github\scripts\stage.ps1
# Choose 'f' (Selective File Staging)
# Enter file numbers, commit each individually
```

### Scenario 4: Quick Manual Commit

```powershell
# If you know the format and want to be fast
git add <files>
git commit -m "type(scope): subject"
```

### Scenario 5: Detailed Commit with Template

```powershell
# One-time setup
.\.github\scripts\setup-commit-template.ps1

# Then for each commit
git add <files>
git commit  # Editor opens with template
```

---

## Design Philosophy

### Why These Scripts?

**Problem:** Git commit standards are hard to remember and easy to get wrong.

**Solution:** Interactive prompts that:
- Guide you through the format step-by-step
- Validate your inputs (type, length, etc.)
- Show preview before committing
- Support different workflows (quick vs. detailed)

### Terminal Optimizations

Scripts are designed for:
- ✅ **Narrow terminals** - Single-line descriptions, no word wrap
- ✅ **Short terminals** - Compact menus, minimal scrolling
- ✅ **Fast workflows** - One-letter main menu options
- ✅ **Clear separation** - Letters for menus (s/a/f/q), numbers for files [1][2][3]

### Best Practices

**Use `stage.ps1` for:**
- End-of-session updates (option `s`)
- Multiple file commits (option `a`)
- Clean commit history (option `f`)

**Use `commit.ps1` when:**
- You've already staged files manually
- You want guidance on commit message format

**Use template (`setup-commit-template.ps1`) when:**
- You prefer writing commit messages in your editor
- You want examples and tips visible while writing

**Use manual `git commit -m` when:**
- You know the format by heart
- You want maximum speed
- The commit is simple and straightforward

---

## Troubleshooting

### "ERROR: No staged files"

**Cause:** You ran `commit.ps1` without staging any files.

**Solution:** Stage files first:
```powershell
git add <files>
# OR
.\.github\scripts\stage.ps1  # Choose 'a' or 'f'
```

### "ERROR: Invalid type"

**Cause:** You entered a commit type that doesn't exist.

**Solution:** Use one of the valid types:
- feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

### "WARNING: Subject is longer than 72 characters"

**Cause:** Your subject line is too long.

**Solution:** Shorten the subject. Details go in the body, not the subject.

### Script doesn't run / Permission denied

**Cause:** PowerShell execution policy.

**Solution:**
```powershell
# Check current policy
Get-ExecutionPolicy

# If restricted, set to RemoteSigned (allows local scripts)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Emoji/encoding errors in output

**Cause:** Older PowerShell versions may not support emojis.

**Solution:** Scripts now use plain text (ERROR:, SUCCESS:, etc.) instead of emojis. Update to latest version from repository.

---

## Examples

### Example 1: Feature Addition

```
Type: feat
Scope: api
Subject: add customer search endpoint
Body: Implements fuzzy search on customer name and email.
Uses PostgreSQL full-text search for performance.
Issue: 456

Result:
feat(api): add customer search endpoint

Implements fuzzy search on customer name and email.
Uses PostgreSQL full-text search for performance.

Closes #456
```

### Example 2: Bug Fix

```
Type: fix
Scope: auth
Subject: resolve token expiration issue
Body: Tokens were expiring 1 hour early due to timezone bug.
Now using UTC timestamps consistently.
Issue: 

Result:
fix(auth): resolve token expiration issue

Tokens were expiring 1 hour early due to timezone bug.
Now using UTC timestamps consistently.
```

### Example 3: Documentation Update

```
Type: docs
Scope: session
Subject: update session context with today's work
Body: 
Issue: 

Result:
docs(session): update session context with today's work
```

### Example 4: Chore (Dependency Update)

```
Type: chore
Scope: deps
Subject: update express to 4.18.2
Body: Security patch for CVE-2024-1234
Issue: 

Result:
chore(deps): update express to 4.18.2

Security patch for CVE-2024-1234
```

---

## Related Documentation

- **[Git Standards](../../Standards/code/git-standards.md)** - Complete Git workflow documentation
- **[Commit Guide](.././GIT_COMMIT_GUIDE.md)** - Quick start guide for team members
- **[Conventional Commits](https://www.conventionalcommits.org/)** - Official specification

---

## Script Maintenance

### Adding New Scopes

Edit the scope examples in `commit.ps1` and this README to include new common scopes as the project grows.

### Adding New Commit Types

Commit types are standardized by Conventional Commits. Only add new types if they're in the official spec.

### Updating Messages

Keep error messages and prompts clear and concise. Test in both narrow and short terminal windows.

---

## Future Enhancements

Potential improvements tracked in [TODO.md](../../TODO.md):

- [ ] Add `-Help` parameter documentation to all scripts
- [ ] Add automated tests for script workflows
- [ ] Add Git hook integration (pre-commit validation)
- [ ] Add changelog generation command
- [ ] Add release tagging helper script

---

[⬆ Back to top](#git-workflow-scripts) | [🏠 AGOG Home](../../README.md) | [📁 .github](../)
