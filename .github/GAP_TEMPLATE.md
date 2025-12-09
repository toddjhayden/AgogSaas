**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → Gap Entry Template

# Gap Entry Template

Copy this template when adding a new gap to GAPS.md.

---

## Template for New Gap

### [Title] - [Brief Description]
**File:** `path/to/file.md` (or "None" if gap is missing document)  
**Issue:** [Describe the gap, inconsistency, or quality issue]  
**Impact:** [How does this affect users/developers/project?]  

**Resolution Options:**
1. [Option 1]
2. [Option 2]
3. [Option 3]

**Recommendation:** [Which option and why]  
**Priority:** [Critical/High/Medium/Low]  
**Target Date:** YYYY-MM-DD  
**Assigned To:** [Name or "Unassigned"]

**Status:** [Optional: if partially addressed]

---

## Priority Guidelines

**Critical:** Blocks progress, misleading information, security issue
- Examples: Broken core functionality, incorrect technical guidance, missing required specs

**High:** Needed soon, affects quality significantly
- Examples: Missing key documentation, incomplete standards, unclear processes

**Medium:** Should be addressed but not urgent
- Examples: Nice-to-have documentation, quality improvements, convenience features

**Low:** Future enhancement, minimal impact
- Examples: Cosmetic issues, advanced features, automation tools

---

## Where to Add in GAPS.md

1. **Determine priority** (Critical/High/Medium/Low)
2. **Add to appropriate section** in GAPS.md
3. **Update metrics** at bottom of GAPS.md
4. **Consider adding to TODO.md** if it's a discrete task (creating new file)

---

## Example Gap Entry

### Database Standards - Incomplete Partitioning Guidance
**File:** `Standards/data/database-standards.md`  
**Issue:** Partitioning is mentioned briefly but lacks comprehensive guidance on:
- When to partition (table size thresholds)
- Partition strategies (range, list, hash)
- Maintenance procedures (adding/dropping partitions)
- Query patterns for partitioned tables
- Performance implications

**Impact:** Developers may implement partitioning incorrectly or avoid it when beneficial  

**Resolution Options:**
1. Expand Performance Optimization section with comprehensive partitioning subsection
2. Create separate document: `database-partitioning-guide.md`
3. Add partitioning examples to each relevant table definition

**Recommendation:** Option 1 (expand existing section with 2-3 page subsection)  
**Priority:** Medium  
**Target Date:** 2025-12-01  
**Assigned To:** Unassigned

---

[⬆ Back to top](#gap-entry-template) | [🏠 AGOG Home](../README.md)