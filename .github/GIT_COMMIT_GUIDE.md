# Git Commit Quick Start Guide

**For Todd and Future Team Members**

## One-Time Setup (5 minutes)

### Step 1: Set Up Git Aliases (Recommended)
**Makes commands much easier to type!**

```powershell
# Windows (PowerShell)
.\.github\scripts\setup-git-aliases.ps1

# Linux / macOS (Bash)
chmod +x .github/scripts/setup-git-aliases.sh
./.github/scripts/setup-git-aliases.sh
```

After setup, you can use short commands from anywhere in the repository:
- `git agog-stage` - Interactive staging helper
- `git agog-commit` - Interactive commit builder
- `git agog-setup` - Set up commit template

### Step 2: Set Up Commit Template (Optional)
**Only needed if you want to use the template method (Option 2 below).**

```powershell
# If you set up aliases above:
git agog-setup

# Or run directly:
.\.github\scripts\setup-commit-template.ps1  # Windows
./.github/scripts/setup-commit-template.sh   # Linux/Mac
```

**That's it!** You're ready to commit.

---

## Three Ways to Commit

### Option 1: Interactive Staging & Commit (Easiest) ⭐
**Best for:** Learning, complex workflows, staging multiple files  
**Requires:** Git aliases setup (see above)

```powershell
git agog-stage
```

This opens an interactive menu where you can:
- **s)** Quick Session Commit - Stage SESSION_CONTEXT.md and commit
- **a)** Stage All Changed Files - Batch staging
- **f)** Selective File Staging - Choose files, stage & commit in a loop
- **q)** Exit

The script guides you through staging files and creating properly formatted commit messages.

---

### Option 2: Quick One-Liner (Fast)
Best for simple, straightforward commits once you've learned the format.

```powershell
git add <files>
git commit -m "feat(customer): Add search filters"
```

**Format:** `type(scope): subject`

**Common types:** `feat`, `fix`, `docs`, `chore`

**Common scopes:** `api`, `customer`, `job`, `inventory`, `db`, `docs`

---

### Option 3: Template Method (Structured)
Best for commits with more context or multiple changes.

```powershell
git add <files>
git commit
```

Your editor opens with this template:

```
# <type>(<scope>): <subject>

# Example: feat(customer): Add search filters

# --- BODY (Optional) ---
# Explain WHAT changed and WHY

# --- FOOTER (Optional) ---
# Closes #123
```

**Fill in the blanks, save, close. Done!**

---

### Option 4: Direct Commit Helper (Alternative)
Best when you want guided prompts without staging workflow.

```powershell
# If you set up aliases:
git add <files>
git agog-commit

# Or run directly:
git add <files>
.\.github\scripts\commit.ps1           # Windows
./.github/scripts/bash/commit.sh       # Linux/Mac
```

Prompts you for:
1. Type (feat/fix/docs/etc.)
2. Scope (customer/api/job/etc.)
3. Subject (brief description)
4. Body (optional - what/why)
5. Issue number (optional)

Shows preview, you confirm, done!

---

## Real Examples

### Simple Feature
```
feat(customer): Add preference storage
```

### Bug Fix
```
fix(auth): Resolve token expiration edge case
```

### Documentation
```
docs(api): Expand customer endpoint documentation
```

### With Body
```
feat(inventory): Implement lot genealogy tracking

Add complete material lot tracking:
- Track lot numbers from receipt to consumption
- Link jobs to specific material lots
- Enable end-to-end traceability

Closes #142
```

### Repository Cleanup
```
chore(repo): Remove root-level Node.js dependencies

Remove package.json and node_modules from repository root.
Violated schema-driven approach, leftover from PoC.

Related: .github/archive/poc-code/README-ARCHIVE.md
```

---

## Cheat Sheet

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(api): Add pagination` |
| `fix` | Bug fix | `fix(auth): Fix token refresh` |
| `docs` | Documentation | `docs(readme): Update setup steps` |
| `style` | Formatting only | `style(customer): Format code` |
| `refactor` | Code cleanup | `refactor(job): Extract validation` |
| `perf` | Performance | `perf(db): Add index on tenant_id` |
| `test` | Tests | `test(estimate): Add unit tests` |
| `chore` | Maintenance | `chore(deps): Update PostgreSQL` |

**Common Scopes:**
- Features: `customer`, `job`, `estimate`, `inventory`, `production`, `equipment`
- Infrastructure: `api`, `auth`, `db`, `config`, `security`
- Documentation: `docs`, `standards`, `arch`

---

## Tips for Success

1. **Subject line:** Start with lowercase after type/scope
   - ✅ `feat(customer): add search`
   - ❌ `feat(customer): Add search`

2. **Imperative mood:** "Add" not "Added" or "Adds"
   - ✅ `fix(auth): resolve token issue`
   - ❌ `fix(auth): resolved token issue`

3. **No period at end of subject**
   - ✅ `docs(api): expand endpoints`
   - ❌ `docs(api): expand endpoints.`

4. **Link to GitHub issues when applicable**
   ```
   feat(customer): Add search filters
   
   Closes #145
   ```

---

## When to Use Body

**Skip body for:**
- Simple, self-explanatory changes
- Documentation updates
- Small bug fixes

**Use body for:**
- Complex features
- Multiple logical changes
- Context that won't be obvious
- Why something was done (not how)

**Example:**
```
feat(inventory): Implement lot genealogy tracking

Add complete material lot tracking with genealogy:
- Track lot numbers from receipt through consumption
- Link jobs to specific material lots used
- Enable end-to-end traceability for quality issues

This addresses the core competitive advantage outlined in
SYSTEM_OVERVIEW.md and enables recall capabilities.

Closes #142
```

---

## Common Mistakes to Avoid

❌ **No type/scope:**
```
Added customer search
```

✅ **Should be:**
```
feat(customer): Add search functionality
```

---

❌ **Past tense:**
```
fix(auth): Fixed token refresh bug
```

✅ **Should be:**
```
fix(auth): Resolve token refresh bug
```

---

❌ **Too vague:**
```
chore: Update stuff
```

✅ **Should be:**
```
chore(deps): Update PostgreSQL to 15.4
```

---

## Need Help?

- **Full guide:** `Standards/code/git-standards.md`
- **Template:** `.gitmessage` (in repo root)
- **Interactive helper:** `.github/scripts/commit.ps1`
- **Ask AI:** Copilot can help format commit messages

---

## Summary

**New to this? Start here:**
1. **One-time setup:** Run `setup-git-aliases.ps1` (see setup section above)
2. **Use the staging helper:** `git agog-stage` - Interactive menu for staging & committing
3. **After a few commits:** You'll memorize the format
4. **Switch to quick one-liners:** `git commit -m "type(scope): subject"`

**Quick Reference:**
- `git agog-stage` - Stage files and commit (interactive menu)
- `git agog-commit` - Commit already-staged files (guided prompts)
- `git agog-setup` - Set up commit template (one-time)

**That's it!** The format becomes second nature after 3-5 commits.
