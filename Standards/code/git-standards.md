**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → [Code Standards](./README.md) → Git Standards

# Git Standards

> **Version:** 1.0.0  
> **Last Updated:** 2025-11-02  
> **Status:** Active - Enforced on all commits  
> **Related:** [Schema-Driven Development](./schema-driven-development.md), [Blue-Green Deployment](./blue-green-deployment.md)

## Overview

This document defines Git workflow standards for the AGOG project. These standards enable automated documentation generation, clear project history, and effective team collaboration.

**Core Principles:**
- **Semantic Commits:** Structured commit messages enable automation
- **Clear History:** Every commit tells a story
- **Traceable Changes:** Link commits to issues, PRs, and documentation
- **Automation-Ready:** Commit format supports auto-changelog, auto-documentation
- **Quality Gates:** Standards enforced via CI/CD

---

## Commit Message Format

### Structure

All commit messages follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Rules:**
- **Subject line:** Max 72 characters, imperative mood ("Add" not "Added")
- **Body:** Optional, wrap at 72 characters, explain WHAT and WHY (not HOW)
- **Footer:** Optional, references to issues/PRs, breaking changes

### Commit Types

Use these standardized types to enable automated changelog generation:

| Type | Description | Changelog Section | Example |
|------|-------------|-------------------|---------|
| `feat` | New feature | Features | `feat(api): Add customer search endpoint` |
| `fix` | Bug fix | Bug Fixes | `fix(auth): Resolve JWT token expiration issue` |
| `docs` | Documentation only | Documentation | `docs(api): Expand API specification with inventory endpoints` |
| `style` | Code style (formatting, no logic change) | - | `style(customer): Format customer service code` |
| `refactor` | Code refactoring (no feature/fix) | - | `refactor(job): Extract job validation to separate module` |
| `perf` | Performance improvement | Performance | `perf(query): Add index on customer_id for faster lookups` |
| `test` | Add/update tests | - | `test(estimate): Add unit tests for estimate calculations` |
| `chore` | Maintenance, dependencies, build | - | `chore(deps): Update PostgreSQL driver to 8.16.3` |
| `ci` | CI/CD changes | - | `ci(github): Add automated changelog generation` |
| `build` | Build system changes | - | `build(docker): Update Dockerfile for production` |
| `revert` | Revert previous commit | - | `revert: Revert "feat(api): Add customer search"` |

### Scopes

Scopes indicate which part of the system is affected. Use these standard scopes:

**Core Modules:**
- `api` - API endpoints, specifications
- `auth` - Authentication, authorization
- `customer` - Customer management
- `job` - Job/print job management
- `estimate` - Estimating system
- `inventory` - Inventory, materials, lot tracking
- `production` - Production, scheduling, work orders
- `equipment` - Equipment, JDF integration
- `quality` - Quality control
- `shipping` - Shipping, fulfillment
- `reporting` - Reports, analytics
- `warehouse` - Warehouse management

**Infrastructure:**
- `db` - Database schemas, migrations
- `deploy` - Deployment, infrastructure
- `config` - Configuration
- `security` - Security, access control

**Documentation:**
- `docs` - General documentation
- `standards` - Standards documentation
- `arch` - Architecture documentation

**Multiple Scopes:**
- Use comma-separated: `feat(customer,job): Add customer to job linking`
- Use `*` for global changes: `style(*): Apply prettier formatting project-wide`

### Subject Line

**Format:** `<type>(<scope>): <subject>`

**Rules:**
1. **Imperative mood:** "Add feature" not "Added feature" or "Adds feature"
2. **Lowercase:** Start with lowercase letter (after type/scope)
3. **No period:** Don't end with a period
4. **Max 72 chars:** Keep it concise (type + scope + subject)

**Good Examples:**
```
feat(api): Add pagination to customer list endpoint
fix(auth): Resolve race condition in token refresh
docs(standards): Create git-standards.md with commit format
refactor(inventory): Extract lot tracking to separate service
perf(db): Add composite index on (tenant_id, customer_id)
```

**Bad Examples:**
```
Added new feature              ❌ Not imperative, no type/scope
fix: bug fix                   ❌ Not descriptive
feat(api): Added pagination.   ❌ Not imperative, has period
FEAT(API): ADD PAGINATION      ❌ All caps
feat(api): This is a very long subject line that exceeds the seventy-two character limit  ❌ Too long
```

### Body

**When to include:**
- Complex changes requiring explanation
- Multiple logical changes in one commit
- Context that won't be obvious from code
- WHY a change was made (motivation, alternatives considered)

**Format:**
- Separate from subject with blank line
- Wrap at 72 characters
- Use bullet points for multiple items
- Explain WHAT and WHY, not HOW

**Example:**
```
feat(inventory): Implement lot genealogy tracking

Add complete material lot tracking with genealogy:
- Track lot numbers from receipt through consumption
- Link jobs to specific material lots used
- Enable end-to-end traceability for quality issues
- Support FIFO, LIFO, and specific lot selection

This addresses the core competitive advantage outlined in
SYSTEM_OVERVIEW.md and enables recall capabilities required
for print industry compliance.

Related: #42, SYSTEM_OVERVIEW.md "Architectural Foundation"
```

### Footer

**Use for:**
- Issue references: `Closes #123`, `Fixes #456`, `Relates to #789`
- Breaking changes: `BREAKING CHANGE: <description>`
- Co-authors: `Co-authored-by: Name <email>`
- Documentation links: `Documented in: Standards/api/api-specification.md`

**Examples:**
```
Closes #123
Fixes #456, #457
Relates to #789

BREAKING CHANGE: Customer API now requires tenant_id in all requests.
Migration guide: docs/migrations/v2-migration.md

Co-authored-by: AI Assistant <ai@agog.app>
```

---

## Complete Commit Examples

### Simple Feature
```
feat(customer): Add customer preferences storage

Closes #145
```

### Complex Feature with Context
```
feat(api): Add comprehensive API specification

Expand api-specification.md from skeleton to comprehensive spec (~950 lines):
- Add authentication & authorization patterns (JWT, RBAC)
- Document multi-tenant isolation strategy
- Define pagination standards with metadata and links
- Standardize error response format across all endpoints
- Define core API endpoints (Customers, Jobs, Estimates, Inventory, etc.)
- Add WebSocket real-time events specification
- Document rate limiting strategy

This provides single source of truth for API contracts and enables
automated API documentation generation.

Closes #132
Documented in: Project Architecture/api/api-specification.md
Related: Standards/api/rest-standards.md
```

### Bug Fix
```
fix(auth): Resolve JWT token expiration edge case

Token refresh was failing when refresh_token expired exactly at
request time due to millisecond precision mismatch. Added 5-second
grace period to prevent false rejections.

Fixes #201
```

### Documentation
```
docs(standards): Create git-standards.md with commit format

Define commit message format, branch naming, PR template, and
release tagging conventions to enable automated documentation
generation on commits.

Closes #178
```

### Breaking Change
```
feat(api): Migrate to UUIDv7 for all primary keys

BREAKING CHANGE: All entity IDs now use UUIDv7 (time-ordered) instead
of UUIDv4 (random). Existing IDs must be migrated.

Migration guide: Implementation/database/migrations/V2.0.0__uuid_v7.sql
Impact: Improved query performance, better indexing, chronological sorting

Closes #88
Documented in: Standards/data/database-standards.md
```

### Repository Cleanup
```
chore(repo): Remove root-level Node.js dependencies

Remove package.json, package-lock.json, and node_modules from repository
root. These violated schema-driven approach (YAML → SQL, not TypeORM) and
were leftover from early PoC exploration.

Repository root now clean: only active code and configuration.

Related: .github/archive/poc-code/README-ARCHIVE.md
Aligns with: CONSTRAINTS.md, schema-driven development standard
```

---

## Branch Naming Conventions

### Format

```
<type>/<scope>-<short-description>
```

**Examples:**
```
feature/customer-preferences
fix/auth-token-expiration
docs/api-specification
refactor/inventory-lot-tracking
chore/update-dependencies
```

### Branch Types

| Type | Purpose | Example |
|------|---------|---------|
| `feature/` | New feature development | `feature/job-scheduling` |
| `fix/` | Bug fixes | `fix/customer-search-null` |
| `docs/` | Documentation work | `docs/navigation-path-phase2` |
| `refactor/` | Code refactoring | `refactor/estimate-calculations` |
| `chore/` | Maintenance, dependencies | `chore/upgrade-postgres-15` |
| `test/` | Test additions/improvements | `test/inventory-integration` |
| `hotfix/` | Urgent production fixes | `hotfix/security-patch-jwt` |
| `release/` | Release preparation | `release/v1.2.0` |

### Branch Naming Rules

1. **Lowercase:** All lowercase with hyphens
2. **Descriptive:** Clear indication of purpose
3. **Concise:** 2-4 words in description
4. **No special chars:** Only letters, numbers, hyphens, slashes
5. **Match commits:** Branch type should align with commit types

**Good Examples:**
```
feature/api-pagination
fix/duplicate-job-numbers
docs/git-standards
refactor/customer-service
hotfix/sql-injection-patch
```

**Bad Examples:**
```
my-branch                    ❌ No type
feature/add_pagination       ❌ Underscore instead of hyphen
FIX/Auth-Bug                 ❌ Mixed case
feature/this-is-a-very-long-branch-name-describing-everything  ❌ Too long
```

### Protected Branches

**Branch:** `main`
- Production-ready code only
- Requires PR approval
- Requires passing CI/CD
- No direct commits
- Auto-deploys to production (blue-green)

**Branch:** `develop` (if used)
- Integration branch for features
- Requires PR approval
- Requires passing CI/CD
- Auto-deploys to staging

**Branch:** `feature`
- Current primary development branch
- Will be merged to `main` after initial implementation

---

## Pull Request Standards

### PR Title Format

Use same format as commit messages:

```
<type>(<scope>): <description>
```

**Examples:**
```
feat(api): Add customer search with filters
fix(auth): Resolve token refresh race condition
docs(standards): Create git standards document
```

### PR Description Template

Create `.github/pull_request_template.md`:

```markdown
## Description
<!-- Brief description of changes -->

## Type of Change
- [ ] Feature (non-breaking change adding functionality)
- [ ] Bug Fix (non-breaking change fixing an issue)
- [ ] Breaking Change (fix or feature causing existing functionality to change)
- [ ] Documentation (documentation-only changes)
- [ ] Refactoring (code changes with no functionality change)
- [ ] Performance (performance improvements)
- [ ] Chore (maintenance, dependencies, build changes)

## Scope
<!-- Which module(s) are affected? customer, job, api, db, etc. -->

## Changes Made
<!-- Detailed list of changes -->
- 
- 
- 

## Testing
<!-- How was this tested? -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Database migrations tested (if applicable)

## Database Changes (if applicable)
<!-- Only fill out if this PR includes database schema changes -->
- [ ] Follows [Data Quality Standards](../Standards/data/data-quality.md)
- [ ] Follows [Migration Standards](../Standards/data/migration-standards.md)
- [ ] All tables have tenant_id
- [ ] Critical fields have validation constraints
- [ ] Foreign keys have ON DELETE rules
- [ ] Audit triggers added for sensitive tables
- [ ] Includes rollback script
- [ ] Tested with invalid data

## Documentation
<!-- What documentation was updated? -->
- [ ] Code comments added/updated
- [ ] API documentation updated
- [ ] Standards documentation updated
- [ ] README updated
- [ ] GAPS.md updated (if applicable)
- [ ] TODO.md updated (if applicable)

## Related Issues
<!-- Link to related issues -->
Closes #
Fixes #
Relates to #

## Breaking Changes
<!-- If applicable, describe breaking changes and migration path -->

## Checklist
- [ ] Code follows project standards
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Dependent changes merged
```

### PR Review Requirements

**Before Requesting Review:**
1. All tests pass locally
2. Code follows standards
3. Documentation updated
4. Self-review completed
5. No merge conflicts

**Review Process:**
1. At least 1 approval required (for now; will increase with team growth)
2. All CI/CD checks must pass
3. No unresolved conversations
4. Up-to-date with target branch

**Approval Criteria:**
- Code quality and standards compliance
- Test coverage adequate
- Documentation complete
- No security issues
- Performance acceptable
- Breaking changes justified

---

## Release Tagging Conventions

### Semantic Versioning

Follow [SemVer 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-prerelease][+build]
```

**Examples:**
```
1.0.0           - Initial release
1.1.0           - New features (backward compatible)
1.1.1           - Bug fixes (backward compatible)
2.0.0           - Breaking changes
1.2.0-alpha.1   - Pre-release
1.2.0-beta.2    - Beta release
1.2.0-rc.1      - Release candidate
1.2.0+20251102  - Build metadata
```

### Version Increment Rules

**MAJOR version (x.0.0):**
- Breaking API changes
- Database schema changes requiring migration
- Major architectural changes
- Incompatible with previous version

**MINOR version (1.x.0):**
- New features (backward compatible)
- New API endpoints
- Enhancements to existing features
- Deprecations (with backward compatibility)

**PATCH version (1.1.x):**
- Bug fixes (backward compatible)
- Security patches
- Documentation updates
- Performance improvements (no API changes)

### Tag Format

```
v<version>
```

**Examples:**
```
v1.0.0
v1.2.3
v2.0.0-beta.1
```

### Creating Tags

**Annotated tags (preferred):**
```bash
git tag -a v1.2.0 -m "Release version 1.2.0: Customer preferences and API pagination"
git push origin v1.2.0
```

**Tag message format:**
```
Release version <version>: <brief description>

Major changes:
- Feature 1
- Feature 2
- Bug fix 1

Breaking changes:
- Breaking change description

See CHANGELOG.md for complete details.
```

### Pre-release Tags

**Alpha:** Early testing, unstable
```
v1.2.0-alpha.1
v1.2.0-alpha.2
```

**Beta:** Feature complete, testing in progress
```
v1.2.0-beta.1
v1.2.0-beta.2
```

**Release Candidate:** Final testing before release
```
v1.2.0-rc.1
v1.2.0-rc.2
```

---

## Changelog Generation

### Automated Changelog

Commit messages following these standards enable automated changelog generation.

**Changelog sections from commit types:**
- `feat` → **Features**
- `fix` → **Bug Fixes**
- `perf` → **Performance Improvements**
- `docs` → **Documentation**
- Breaking changes → **BREAKING CHANGES** (top of changelog)

**Example generated changelog entry:**
```markdown
## [1.2.0] - 2025-11-02

### Features
- **api**: Add customer search with filters (#145)
- **inventory**: Implement lot genealogy tracking (#142)
- **job**: Add job scheduling optimization (#138)

### Bug Fixes
- **auth**: Resolve token refresh race condition (#201)
- **customer**: Fix duplicate customer number validation (#198)

### Performance Improvements
- **db**: Add composite index on (tenant_id, customer_id) (#156)

### Documentation
- **standards**: Create git-standards.md with commit format (#178)
- **api**: Expand API specification with inventory endpoints (#132)

### BREAKING CHANGES
- **api**: Customer API now requires tenant_id in all requests
  Migration guide: docs/migrations/v2-migration.md (#88)
```

### Manual Changelog

For releases, create/update `CHANGELOG.md` in repository root:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature in progress

## [1.2.0] - 2025-11-02

### Added
- Customer preference storage with paper, color profile defaults
- API pagination for customer, job, estimate endpoints
- Lot genealogy tracking for complete material traceability

### Changed
- Improved JWT token refresh handling with grace period

### Fixed
- Customer search null handling for optional fields
- Duplicate job number validation in multi-tenant scenarios

### Security
- Enhanced SQL injection protection in search queries

## [1.1.0] - 2025-10-15
...
```

---

## GitHub Actions Integration

### Automated Commit Validation

Create `.github/workflows/commit-lint.yml`:

```yaml
name: Commit Lint

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Validate commit messages
        uses: wagoid/commitlint-github-action@v5
        with:
          configFile: .commitlintrc.json
```

### Configuration Files

**`.commitlintrc.json`:**
```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "chore",
        "ci",
        "build",
        "revert"
      ]
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 72]
  }
}
```

### Automated Documentation Updates

**On commit to main:**
- Auto-generate changelog from commits
- Update version numbers
- Create GitHub release
- Deploy documentation site

**Example workflow:**
```yaml
name: Auto Documentation

on:
  push:
    branches: [main]

jobs:
  update-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate changelog
        uses: conventional-changelog/standard-version@v9
        
      - name: Update documentation
        run: |
          # Auto-update API docs
          # Auto-update architecture diagrams
          # Publish documentation site
```

---

## Commit Tools & Helpers

### Git Commit Template (Recommended for All Developers)

The repository includes a commit message template that pre-fills the format when you run `git commit`.

**Setup (one-time per developer workstation):**

```bash
# PowerShell or Command Prompt
.\.github\scripts\setup-commit-template.ps1

# Or manually:
git config commit.template .gitmessage
```

**Usage:**

```bash
# Stage your changes
git add <files>

# Open commit editor with template pre-filled
git commit

# Your editor opens with template - fill in the blanks, save, and close
```

**Template Location:** `.gitmessage` in repository root

**Template Features:**
- Pre-filled format with type/scope/subject structure
- Inline examples
- Complete type and scope reference
- Tips for good commit messages
- Links to full documentation

### Interactive Commit Helper (Optional)

For developers who prefer an interactive prompt-based workflow:

**Location:** `.github/scripts/commit.ps1`

**Usage:**

```bash
# Stage your changes
git add <files>

# Run interactive helper
.\.github\scripts\commit.ps1
```

**Features:**
- Prompts for type, scope, subject, body, issue number
- Validates type selection
- Shows staged files
- Previews commit message before committing
- Confirms before executing

**Help:**
```bash
.\.github\scripts\commit.ps1 -Help
```

**Note:** This is optional - the commit template works great on its own!

### Quick Reference Card

**Simple commit (quick one-liner):**
```bash
git commit -m "feat(customer): Add search filters"
```

**Full commit (with template):**
```bash
git commit
# Editor opens with template
# Fill in: type, scope, subject, optional body/footer
# Save and close
```

**Interactive commit (with helper):**
```bash
.\.github\scripts\commit.ps1
# Answers prompts
# Reviews preview
# Confirms
```

---

## Best Practices

### Commit Frequency

**Do:**
- Commit logical units of work
- Commit after completing a feature/fix
- Commit before switching tasks
- Commit tested, working code

**Don't:**
- Commit broken/incomplete code to shared branches
- Make "WIP" commits on `main` or `develop`
- Bundle unrelated changes in one commit
- Commit generated files (unless necessary)

### Commit Size

**Ideal commit:**
- Single logical change
- Can be reverted independently
- Can be cherry-picked if needed
- < 400 lines changed (guideline, not hard rule)

**If commit is too large:**
- Split into multiple commits
- Use interactive staging: `git add -p`
- Consider if refactoring is needed

### Rewriting History

**Safe (on feature branches):**
- `git commit --amend` - Fix last commit message
- `git rebase -i` - Clean up commit history before PR
- `git rebase main` - Update feature branch

**Never (on shared branches):**
- Don't rewrite history on `main`, `develop`, `release/*`
- Don't force push to shared branches
- Don't amend pushed commits (unless on personal branch)

### Merge Strategies

**For feature branches → main:**
- **Squash and merge** (default for most PRs)
  - Clean linear history
  - One commit per PR
  - Easier to revert

**For release branches → main:**
- **Merge commit** (preserve release history)
  - Maintains full commit history
  - Clear release boundaries

**For hotfixes:**
- **Squash and merge** or **merge commit**
  - Depends on urgency and complexity

---

## Enforcement

### Pre-commit Hooks

Install pre-commit hooks to enforce standards:

**`.git/hooks/commit-msg`:**
```bash
#!/bin/bash
# Validate commit message format

commit_msg_file=$1
commit_msg=$(cat "$commit_msg_file")

# Check format: type(scope): subject
if ! echo "$commit_msg" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .{1,72}$'; then
    echo "❌ Invalid commit message format"
    echo ""
    echo "Format: <type>(<scope>): <subject>"
    echo "Example: feat(api): Add customer search endpoint"
    echo ""
    echo "See Standards/code/git-standards.md for details"
    exit 1
fi

echo "✅ Commit message format valid"
```

### CI/CD Checks

All PRs must pass:
- Commit message format validation
- Code linting
- Unit tests
- Integration tests
- Security scanning
- Documentation checks

### Review Checklist

Reviewers must verify:
- [ ] Commit messages follow standard
- [ ] Branch naming follows standard
- [ ] PR description complete
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or justified and documented)

---

## Migration from Existing Commits

**For existing commits not following standard:**
1. Continue with old format (don't rewrite history on `main`)
2. Start following standard from now forward
3. Update `CHANGELOG.md` manually for old commits if needed

**For feature branches:**
1. Can rebase and clean up commit messages before merging
2. Use interactive rebase: `git rebase -i main`
3. Reword commits to follow standard

---

## Related Documentation

- [Schema-Driven Development](./schema-driven-development.md) - Development workflow
- [Blue-Green Deployment](./blue-green-deployment.md) - Deployment strategy
- [API Specification](../../Project%20Architecture/api/api-specification.md) - API versioning
- [Database Standards](../data/database-standards.md) - Migration standards
- [GitHub Flow](https://guides.github.com/introduction/flow/) - GitHub workflow guide
- [Semantic Versioning](https://semver.org/) - Version numbering
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit format spec
- [Keep a Changelog](https://keepachangelog.com/) - Changelog format

---

## Examples Repository

For real-world examples of these standards in action, see:
- Recent commits on `main` branch
- Merged pull requests
- Release tags and changelogs
- `.github/workflows/` for automation

---

## Updates to This Standard

**This document is versioned.**

Changes to git standards require:
1. PR with rationale for change
2. Team review and approval
3. Update version number at top
4. Document in "Updates" section below
5. Communicate to team

### Update History

- **1.0.0** (2025-11-02) - Initial git standards creation

---

[⬆ Back to top](#git-standards) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md) | [💻 Code Standards](./README.md)
