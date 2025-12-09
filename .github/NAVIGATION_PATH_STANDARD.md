**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → Navigation Path Standard

# Navigation Path Standard

## Purpose
Prevent users from getting lost in nested documentation by showing the full path to any document.

**Note:** This is called "Navigation Path" (not "breadcrumbs") for international team clarity.

## Format

### Top of Every Markdown File
```markdown
**📍 Navigation Path:** [AGOG Home](path/to/README.md) → [Parent](path/to/parent.md) → Current Page
```

### Bottom of Every Markdown File
```markdown
---

[⬆ Back to top](#) | [🏠 AGOG Home](path/to/README.md) | [📚 Parent](path/to/parent.md)
```

**Important:** 
- ❌ **Remove old `[← Back]` links** - they're redundant with bottom navigation
- ✅ Bottom navigation provides same functionality plus more options

## Examples

### Root-Level File (TODO.md, GAPS.md, PROJECT_INDEX.md)
**Top:**
```markdown
**📍 Navigation Path:** [AGOG Home](./README.md) → Current Page Name
```

**Bottom:**
```markdown
---

[⬆ Back to top](#current-page) | [🏠 AGOG Home](./README.md)
```

### One Level Deep (Implementation/README.md, Standards/README.md)
**Top:**
```markdown
**📍 Navigation Path:** [AGOG Home](../README.md) → [Project Index](../PROJECT_INDEX.md) → Implementation
```

**Bottom:**
```markdown
---

[⬆ Back to top](#implementation) | [🏠 AGOG Home](../README.md) | [📑 Project Index](../PROJECT_INDEX.md)
```

### Two Levels Deep (Standards/data/README.md)
**Top:**
```markdown
**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → Data Standards
```

**Bottom:**
```markdown
---

[⬆ Back to top](#data-standards) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md)
```

### Three Levels Deep (Standards/data/database-standards.md)
**Top:**
```markdown
**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → [Data Standards](./README.md) → Database Standards
```

**Bottom:**
```markdown
---

[⬆ Back to top](#database-standards) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md) | [📊 Data Standards](./README.md)
```

### Very Deep Nesting (Implementation/print-industry-erp/database/migrations/README.md)
**Top:**
```markdown
**📍 Navigation Path:** [AGOG Home](../../../../README.md) → [Implementation](../../../README.md) → [Print Industry ERP](../../README.md) → [Database](../README.md) → Migrations
```

**Bottom:**
```markdown
---

[⬆ Back to top](#migrations) | [🏠 AGOG Home](../../../../README.md) | [🔨 Implementation](../../../README.md)
```

**Note:** For very deep files, only show Home + immediate parent in bottom nav (keeps it clean)

## Icons to Use (Optional but Helpful)

- 🏠 Home
- 📑 Project Index  
- 📚 Standards
- 🔨 Implementation
- 🎯 Project Spirit
- 🏗️ Architecture
- 📊 Data
- 🔐 Security
- ⚙️ Configuration
- �️ Project Utilities (for .github/ files)
- �📍 Current location indicator
- ⬆ Back to top

## Special Case: `.github/` Utility Files

Files in `.github/` directory use a **simplified navigation pattern** because they're meta-documentation (documentation about the documentation system):

**Top:**
```markdown
**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → File Name
```

**Bottom:**
```markdown
---

[⬆ Back to top](#file-name) | [🏠 AGOG Home](../README.md)
```

**Why simplified?**
- Not part of main doc tree (Architecture, Standards, Implementation)
- Utility/meta-documentation files
- Only need home link for navigation

**Files this applies to:**
- `.github/MAINTENANCE_ROUTINE.md`
- `.github/GAP_TEMPLATE.md`
- `## Where to Find This Standard

- `.github/NAVIGATION_PATH_STANDARD.md``
- Any future `.github/*.md` files

## Rules

1. **Always show full path** - User should see AGOG Home → ... → Current Page
2. **Use relative paths** - `../` not absolute paths
3. **Include Project Index** when applicable - It's the main navigation hub
4. **Keep it on one line** - Don't wrap navigation path
5. **Place at top** after title, **before** first heading
6. **Place at bottom** after last content, separated by `---` horizontal rule
7. **Link only parents** - Current page is plain text (not clickable)
8. **Remove old `[← Back]` links** - Bottom navigation makes them redundant
9. **Use "Navigation Path" not "Breadcrumbs"** - Clearer for international teams

## Migration Strategy

### Phase 1: Critical Navigation Paths (Do Now)
- ✅ Implementation/README.md (completed)
- [ ] All README.md files in Standards/
- [ ] All README.md files in Project Architecture/
- [ ] All README.md files in Project Spirit/

### Phase 2: Deep Documentation (Next)
- [ ] All .md files in Standards subdirectories
- [ ] All .md files in Project Architecture subdirectories
- [ ] SYSTEM_OVERVIEW.md, BUSINESS_VALUE.md

### Phase 3: Implementation Details (Later)
- [ ] All files in Implementation/print-industry-erp/

### Phase 4: Cleanup (Last)
- [ ] Remove all old `[← Back]` links (redundant with bottom navigation)
- [ ] Verify all paths work
- [ ] Update .ai/context.md with new pattern
- [ ] Search for any remaining "breadcrumb" terminology → change to "navigation path"

## Template for Quick Copy-Paste

```markdown
<!-- Replace paths and names as needed -->
**📍 Navigation Path:** [AGOG Home](../README.md) → [Parent](./README.md) → Current Page

# Page Title

...content...

---

[⬆ Back to top](#page-title) | [🏠 AGOG Home](../README.md) | [Parent](./README.md)
```

**Note:** Remove any old `[← Back]` links when adding navigation path.

## Automation Ideas (Future)

- VS Code snippet for navigation paths
- Script to validate navigation path links
- Script to auto-generate navigation paths from file structure
- Pre-commit hook to check navigation paths exist

---

[⬆ Back to top](#navigation-path-standard) | [🏠 AGOG Home](../README.md)

