**📍 Navigation Path:** [AGOG Home](../README.md) → .github

# .github Utilities

> **Central hub for project management, session recovery, and Git workflow tools.**

---

## 🚀 Quick Start for New Team Members

### 1. Set Up Git Workflow (5 minutes)
Run this once to make Git commands easier:

```powershell
# Windows (PowerShell)
.\.github\scripts\setup-git-aliases.ps1

# Linux / macOS (Bash)
chmod +x .github/scripts/setup-git-aliases.sh
./.github/scripts/setup-git-aliases.sh
```

**After setup, use these commands from anywhere in the repository:**
- `git agog-stage` - Stage files and commit (interactive menu)
- `git agog-commit` - Commit with guided prompts
- `git agog-setup` - Set up commit template

**Full guide:** [GIT_COMMIT_GUIDE.md](./GIT_COMMIT_GUIDE.md)

### 2. Read AI Onboarding (For AI Sessions)
If you're an AI assistant starting a new session:
- **Start here:** [AI_ONBOARDING.md](./AI_ONBOARDING.md)
- **Then read:** [SESSION_CONTEXT.md](./SESSION_CONTEXT.md)

---

## 📁 Directory Structure

### Git Workflow Scripts
**Location:** `scripts/`
- **`scripts/README.md`** - Complete documentation for all scripts
- **`scripts/setup-git-aliases.ps1|.sh`** - One-time setup for Git aliases
- **`scripts/powershell/`** - Windows PowerShell scripts
  - `stage.ps1` - Interactive staging helper
  - `commit.ps1` - Guided commit message builder
  - `setup-commit-template.ps1` - Configure commit template
- **`scripts/bash/`** - Linux/macOS Bash scripts
  - `stage.sh` - Interactive staging helper
  - `commit.sh` - Guided commit message builder
  - `setup-commit-template.sh` - Configure commit template

**See:** [scripts/README.md](./scripts/README.md)

### Session Management
**For AI continuity across sessions:**
- **`SESSION_CONTEXT.md`** - Current work state, recent changes, next actions
- **`AI_ONBOARDING.md`** - Read-first guide for new AI sessions
- **`SESSION_HANDOFF_GUIDE.md`** - How to hand off between sessions
- **`SESSION_UPDATE_TEMPLATE.md`** - Template for updating session context
- **`NEW_SESSION_PROMPT_TEMPLATE.md`** - Template for starting new sessions

### Documentation Standards
**Quality and consistency tools:**
- **`NAVIGATION_PATH_STANDARD.md`** - Navigation pattern for all docs
- **`MAINTENANCE_ROUTINE.md`** - Keep documentation healthy
- **`GAP_TEMPLATE.md`** - Template for tracking documentation gaps
- **`DECISION_LOG.md`** - Record of architectural decisions

### Reference Materials
- **`GIT_COMMIT_GUIDE.md`** - Quick start guide for Git commits
- **`archive/`** - Archived code and documentation
  - `poc-code/` - Original PoC code (deprecated, preserved for reference)

---

## 🔧 Common Tasks

### Committing Changes

**Easiest (Interactive):**
```bash
git agog-stage
```
Opens menu: stage files, commit with guided prompts, repeat.

**Quick (One-liner):**
```bash
git commit -m "feat(customer): Add search filters"
```

**See:** [GIT_COMMIT_GUIDE.md](./GIT_COMMIT_GUIDE.md)

### Starting a New AI Session

1. Read [AI_ONBOARDING.md](./AI_ONBOARDING.md)
2. Read [SESSION_CONTEXT.md](./SESSION_CONTEXT.md)
3. Check "What We're Working On RIGHT NOW" section
4. Review "Next Planned Actions"
5. Start working!

### Updating Session Context

Before ending a work session:
```bash
# Update SESSION_CONTEXT.md with:
- What was completed
- What's in progress
- Next planned actions
- Any blockers discovered
```

**See:** [SESSION_UPDATE_TEMPLATE.md](./SESSION_UPDATE_TEMPLATE.md)

### Maintaining Documentation Quality

**Weekly routine:**
- Check [MAINTENANCE_ROUTINE.md](./MAINTENANCE_ROUTINE.md)
- Update [../GAPS.md](../GAPS.md) with any new issues
- Review recent commits for documentation updates needed

---

## 📚 Key Documentation

### For Humans
- **[GIT_COMMIT_GUIDE.md](./GIT_COMMIT_GUIDE.md)** - How to write good commit messages
- **[scripts/README.md](./scripts/README.md)** - How to use Git workflow scripts

### For AI Sessions
- **[AI_ONBOARDING.md](./AI_ONBOARDING.md)** - Start here for new sessions
- **[SESSION_CONTEXT.md](./SESSION_CONTEXT.md)** - Current project state
- **[DECISION_LOG.md](./DECISION_LOG.md)** - Why we made key decisions

### For Documentation Quality
- **[NAVIGATION_PATH_STANDARD.md](./NAVIGATION_PATH_STANDARD.md)** - Navigation pattern
- **[MAINTENANCE_ROUTINE.md](./MAINTENANCE_ROUTINE.md)** - Keep docs healthy
- **[GAP_TEMPLATE.md](./GAP_TEMPLATE.md)** - Track documentation gaps

---

## 🎯 Quick Reference

### Git Aliases (After Setup)
| Command | What It Does |
|---------|-------------|
| `git agog-stage` | Interactive staging menu (stage files, commit, repeat) |
| `git agog-commit` | Guided commit message builder (for pre-staged files) |
| `git agog-setup` | One-time commit template setup |

### Commit Message Format
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Common types:** `feat`, `fix`, `docs`, `chore`, `refactor`  
**Common scopes:** `api`, `customer`, `job`, `inventory`, `db`, `docs`

**Example:**
```
feat(customer): Add search filters

Add ability to search customers by name, email, or company.
Includes partial match support and case-insensitive search.

Closes #145
```

---

## 🔗 Related Documentation

- **[Standards/code/git-standards.md](../Standards/code/git-standards.md)** - Complete Git standards
- **[CONSTRAINTS.md](../CONSTRAINTS.md)** - Hard rules that must not be violated
- **[GAPS.md](../GAPS.md)** - Documentation quality tracking
- **[TODO.md](../TODO.md)** - Project task tracking
- **[PROJECT_INDEX.md](../PROJECT_INDEX.md)** - Complete project navigation

---

## 💡 Tips

**For new team members:**
1. Set up Git aliases first (see Quick Start above)
2. Use `git agog-stage` for your first few commits to learn the format
3. Read [GIT_COMMIT_GUIDE.md](./GIT_COMMIT_GUIDE.md) for examples
4. After 3-5 commits, switch to quick one-liners

**For AI sessions:**
1. Always read [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) first
2. Update it before ending your session
3. Check [DECISION_LOG.md](./DECISION_LOG.md) before making architectural changes
4. Follow [CONSTRAINTS.md](../CONSTRAINTS.md) rules strictly

**For documentation work:**
1. Add Navigation Paths to new docs (see [NAVIGATION_PATH_STANDARD.md](./NAVIGATION_PATH_STANDARD.md))
2. Track gaps in [../GAPS.md](../GAPS.md)
3. Follow [MAINTENANCE_ROUTINE.md](./MAINTENANCE_ROUTINE.md) weekly

---

[⬆ Back to top](#github-utilities) | [🏠 AGOG Home](../README.md) | [📋 Project Index](../PROJECT_INDEX.md)
