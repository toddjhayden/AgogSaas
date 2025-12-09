**📍 Navigation Path:** [AGOG Home](../README.md) → [Standards](../Standards/README.md) → Standards Automation Setup

# Standards Automation - Setup Guide

## Overview

This guide walks you through setting up automated standards enforcement for AGOG. Once configured, standards are checked:

1. **On every commit** (pre-commit hook) - Catches issues immediately
2. **On every PR** (GitHub Actions) - Blocks merging if standards violated
3. **On every push** (GitHub Actions) - Continuous validation

---

## Quick Setup (5 minutes)

### Step 1: Install Dependencies

```powershell
# In repository root
npm install
```

This installs Husky for git hooks.

### Step 2: Initialize Git Hooks

```powershell
# Initialize Husky
npm run prepare
```

This sets up the pre-commit hook.

### Step 3: Test It Works

```powershell
# Run migration linter manually
npm run lint:migrations
```

You should see: `✅ All migrations pass standards checks!` (or issues if migrations exist)

### Step 4: Commit Something

```powershell
git add .
git commit -m "test: Verify pre-commit hook"
```

You should see the migration linter run automatically before the commit succeeds.

**That's it!** Automation is now active locally.

---

## What Gets Checked Automatically

### Pre-Commit Hook (Local)

**Runs before every `git commit`:**
- ✅ Migration linter (checks migrations follow standards)

**Blocks commit if:**
- ❌ Missing `tenant_id` on new tables
- ❌ Foreign keys without `ON DELETE` clause
- ❌ Sensitive tables without audit triggers

**Time:** ~1-2 seconds per commit

### GitHub Actions (CI/CD)

**Runs on every push and PR:**

1. **Migration Linting**
   - Same checks as pre-commit hook
   - Fails PR if violations found
   - Posts comment on PR with details

2. **Standards Validation**
   - Checks for TODO/FIXME in changed files
   - Warns if found (doesn't fail build)

3. **PR Checklist Verification**
   - Ensures PR description has checklist
   - Warns about unchecked items
   - Reminds reviewer to verify

4. **Link Validation**
   - Checks for broken internal links in markdown
   - Fails if broken links found

**Time:** ~30-60 seconds per PR

---

## How to Use Daily

### As a Developer

**Normal workflow (nothing changes):**
```powershell
# Make changes
git add .
git commit -m "feat(db): Add customer ratings table"
# ← Linter runs automatically here
# ← Commit succeeds only if checks pass
```

**If linter finds issues:**
```powershell
# Linter output shows:
❌ Table 'customer_ratings' missing tenant_id column
💡 Add: tenant_id UUID NOT NULL
📖 Standard: Multi-tenancy (database-standards.md)

# Fix the issue in your migration
# Then commit again
git commit -m "feat(db): Add customer ratings table"
# ← Should pass now
```

**Skip checks (emergency only):**
```powershell
# If you MUST commit despite failures (not recommended)
git commit --no-verify -m "wip: Work in progress"
```

### As a Reviewer

**PR checks show in GitHub:**
- ✅ All green = safe to merge
- ❌ Any red = must fix before merge
- ⚠️ Yellow warnings = review carefully

**GitHub automatically:**
- Runs all checks on every PR
- Updates check status in real-time
- Blocks merge button if checks fail (when configured)

---

## Configuration

### Customize What Gets Checked

**Edit `scripts/lint-migrations.js`:**

```javascript
// Change which tables are considered "sensitive" (require audit triggers)
const SENSITIVE_TABLES = ['customers', 'orders', 'jobs', 'users', 'payments'];

// Add more sensitive tables:
const SENSITIVE_TABLES = ['customers', 'orders', 'jobs', 'users', 'payments', 'invoices', 'transactions'];
```

### Add More Pre-Commit Checks

**Edit `.husky/pre-commit`:**

```bash
# Add TypeScript linting
echo "🔍 Checking TypeScript..."
npm run lint

# Add unit tests
echo "🧪 Running tests..."
npm test
```

### Require Checks for PR Merging

**In GitHub Repository Settings:**
1. Go to Settings → Branches
2. Click "Add rule" for `main` branch
3. Check "Require status checks to pass"
4. Select:
   - ✅ Validate Database Migrations
   - ✅ Validate Code Standards
   - ✅ Validate Documentation Links
5. Save

Now PRs **cannot merge** if checks fail!

---

## Troubleshooting

### Pre-commit hook not running

```powershell
# Reinstall hooks
npm run prepare

# Or manually
npx husky install
```

### Linter giving false positives

**System tables don't need tenant_id:**
```sql
-- Add comment to migration
-- Note: System table - no tenant_id needed
CREATE TABLE audit_log (...);
```

**Want to ignore specific warning:**
```javascript
// Edit scripts/lint-migrations.js
// Comment out the check you don't want
```

### GitHub Actions not running

**Check `.github/workflows/data-quality.yml` exists:**
```powershell
ls .github/workflows/
# Should show: data-quality.yml
```

**Ensure workflow is enabled:**
1. Go to GitHub → Actions tab
2. Enable workflows if disabled

### Linter is too slow

**Check only changed files:**
```javascript
// Edit scripts/lint-migrations.js
// Add logic to check only files changed in last commit
const changedFiles = execSync('git diff --name-only HEAD~1 HEAD').toString().split('\n');
```

---

## Disabling Automation

### Temporarily (local only)

```powershell
# Skip pre-commit hook once
git commit --no-verify -m "message"
```

### Permanently (not recommended)

```powershell
# Remove git hooks
rm -rf .husky

# Or disable in package.json
# Remove "prepare": "husky install" script
```

---

## What Standards Are Enforced

See comprehensive documentation:

- **[Data Quality Standards](../Standards/data/data-quality.md)** - Validation, integrity, audit trails
- **[Migration Standards](../Standards/data/migration-standards.md)** - Safe database changes
- **[Database Standards](../Standards/data/database-standards.md)** - Schema design, multi-tenancy

### Quick Checklist

**Every migration must:**
- ✅ Include `tenant_id UUID NOT NULL` on all tables (except system tables)
- ✅ Have `ON DELETE` clause on all foreign keys (`RESTRICT`, `CASCADE`, or `SET NULL`)
- ✅ Include validation constraints on numeric fields (quantity > 0, amount >= 0)
- ✅ Add audit triggers for sensitive tables (customers, orders, jobs, etc.)
- ✅ Have rollback script (`*_rollback.sql`)

---

## Extending Automation

### Add More Checks

**Create `scripts/validate-standards.js`:**
```javascript
// Check for TypeScript naming conventions
// Check for API route patterns
// Check for test coverage
// etc.
```

**Add to workflow:**
```yaml
# Edit .github/workflows/data-quality.yml
- name: Validate TypeScript Standards
  run: node scripts/validate-standards.js
```

### Add Database Tests

**Create test database in CI:**
```yaml
services:
  postgres:
    image: postgres:15
    env:
      POSTGRES_PASSWORD: test
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
```

**Run migrations against test DB:**
```yaml
- name: Test migrations
  run: |
    npm run db:migrate
    npm run test:migrations
```

---

## Getting Help

**Issues with automation?**
- Check [troubleshooting section](#troubleshooting) above
- Review error messages carefully - they include hints
- See standards docs for detailed requirements

**Want to add more checks?**
- See [extending automation](#extending-automation) section
- Reference existing scripts in `scripts/` directory
- Ask in team chat or create issue

---

## Summary

✅ **5-minute setup** - Just `npm install` and `npm run prepare`  
✅ **Automatic enforcement** - Standards checked on every commit and PR  
✅ **Clear feedback** - Error messages include hints and links to standards  
✅ **Customizable** - Easy to add more checks or adjust rules  
✅ **Non-intrusive** - Runs fast, can skip if needed (emergencies only)

**Result:** Standards followed consistently without manual checking!

---

[⬆ Back to top](#standards-automation---setup-guide) | [🏠 AGOG Home](../README.md) | [📚 Standards](../Standards/README.md)
