**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → Session Update Template

# Session Context Update Template

> **🎯 Purpose:** Quick reference for updating SESSION_CONTEXT.md during work  
> **⏱️ Time Required:** 30 seconds to 2 minutes  
> **📅 Use When:** After completing work, before breaks, every 30-60 minutes

---

## Quick Checkpoint (30 seconds)

**Just update the progress numbers:**

Open `.github/SESSION_CONTEXT.md` and find "What We're Working On RIGHT NOW" section:

```markdown
> **🔄 Last Updated:** 2025-10-31 [ADD CURRENT TIME: 2:30pm]
> **📊 Session Status:** Active - [CURRENT WORK]

## What We're Working On RIGHT NOW

### Primary Focus: [Your Current Task]
**Status:** [UPDATE PROGRESS: "9 of 15 files complete" → "11 of 15 files complete"]

**Current Phase:**
- ✅ Complete: [ADD WHAT YOU JUST FINISHED]
- 🚧 In Progress: [UPDATE CURRENT FILE/TASK]
- ⏳ NEXT: [WHAT'S COMING UP]
```

**Quick commit:**
```powershell
git commit -am "checkpoint: [brief update - e.g., '11/15 navigation files']"
git push
```

**Done!** Protected against session loss.

---

## Full Update (2-3 minutes)

**When you've done significant work:**

### 1. Update Top Section
```markdown
> **🔄 Last Updated:** [TODAY'S DATE + TIME]
> **👤 Updated By:** Todd + AI Assistant
> **📊 Session Status:** Active - [CURRENT WORK] | Handoff ready | Completed [X]
```

### 2. Update "What We're Working On RIGHT NOW"

**Pattern:**
- Move "🚧 In Progress" items to "✅ Complete" when done
- Add new "⏳ NEXT:" items
- Update progress counts/percentages
- Add notes about decisions or blockers

```markdown
### Primary Focus: Navigation Path System
**Status:** Phase 1 - [NEW COUNT] of 15 files complete
**Timeline:** On track for 2025-11-15

**Current Phase:**
- ✅ Complete: PROJECT_INDEX.md, Implementation/README.md, Standards/README.md, 
               Standards/data/README.md, .github/ files, 
               [ADD NEW COMPLETED ITEMS]
- ⏳ NEXT: [WHAT SHOULD HAPPEN NEXT]

**Recent Achievement:**
[ADD IF YOU COMPLETED SOMETHING SIGNIFICANT]
```

### 3. Add to "Recent Major Changes" (If Significant Work)

**Only add if you:**
- Completed a major feature/phase
- Made an architectural decision
- Discovered/resolved a significant issue
- Created new files/systems

```markdown
### [Feature/Change Name] (2025-10-31)
**What:** [Brief description of what you did]
**Why:** [Reason for the change]
**Impact:** [What this affects]
**Files:** [Key files created/updated]
```

**Place at TOP of "Recent Major Changes" section** (most recent first)

### 4. Update "Known Blockers" (If Any)

**Add new blocker:**
```markdown
### Current Blockers

**Issue:** [Description of problem]
**Impact:** [What's blocked or slowed]
**Discovered:** 2025-10-31
**Plan:** [How you plan to resolve, or "Need to research"]
```

**Resolve blocker:**
Move to "Recently Resolved" section:
```markdown
### Recently Resolved
- ✅ [Issue] - Resolved 2025-10-31: [How it was fixed]
```

### 5. Commit Changes

```powershell
git add .
git commit -m "docs: Update session context - [summary of changes]"
git push origin feature
```

---

## Copy/Paste Snippets

### Adding Completed Items
```markdown
- ✅ Complete: [File/Feature name] ([Optional: brief note])
```

### Marking In Progress
```markdown
- 🚧 In Progress: [File/Feature name] ([Current state: 50% done, etc.])
```

### Adding Next Items
```markdown
- ⏳ NEXT: [What should happen next]
```

### Adding Recent Achievement
```markdown
**Recent Achievement:**
- [What was accomplished]
- [Why it matters]
- [Any important notes]
```

### Adding a Decision Note
```markdown
**Decision Made:**
- [What was decided]
- [Why] (Full details in DECISION_LOG.md if architectural)
```

### Adding a Blocker
```markdown
**Current Blocker:**
- **Issue:** [Problem description]
- **Impact:** [What's affected]
- **Plan:** [Next steps to resolve]
```

---

## Common Update Scenarios

### Scenario 1: Completed 2-3 Files
**Time:** 30 seconds

```markdown
> **🔄 Last Updated:** 2025-10-31 2:45pm

**Status:** Phase 1 - 11 of 15 files complete (was 9 of 15)

- ✅ Complete: Project Architecture/README.md, Project Spirit/README.md
- ⏳ NEXT: Add navigation to workflows/*.md files
```

Commit: `git commit -am "checkpoint: 11/15 navigation files complete"`

---

### Scenario 2: Discovered Issue/Blocker
**Time:** 1 minute

```markdown
> **🔄 Last Updated:** 2025-10-31 3:15pm

**Status:** Phase 1 - 11 of 15 files, discovered issue with nested navigation

**Known Blockers:**
**Issue:** Some files are 4+ levels deep, navigation path gets too long
**Impact:** Navigation Path format needs adjustment for deeply nested files
**Plan:** Consider abbreviated format for deep nesting (Home → ... → Parent → Current)
```

Commit: `git commit -am "docs: Note navigation depth issue in session context"`

---

### Scenario 3: Made Architectural Decision
**Time:** 2-3 minutes

1. **Update SESSION_CONTEXT.md:**
```markdown
> **🔄 Last Updated:** 2025-10-31 4:00pm

**Recent Achievement:**
- Decided to abbreviate navigation for 4+ level nesting
- Format: Home → ... → Parent → Current (see DECISION_LOG.md)
```

2. **Add to DECISION_LOG.md:**
```markdown
### Navigation Path Depth Limit
**Date:** 2025-10-31
**Decision:** Use abbreviated format for files 4+ levels deep
**Rationale:** Full paths get unwieldy (>80 characters)
[... full decision entry ...]
```

3. **Commit:**
```powershell
git commit -am "docs: Add navigation depth decision to DECISION_LOG"
```

---

### Scenario 4: End of Work Session
**Time:** 2-3 minutes

```markdown
> **🔄 Last Updated:** 2025-10-31 5:00pm
> **📊 Session Status:** Handoff ready - Navigation Phase 1 at 13/15

### Primary Focus: Navigation Path System ✅ MOSTLY COMPLETE
**Status:** Phase 1 - 13 of 15 files complete
**Achievement:** Added navigation to all major README files and 80% of workflows

**Current Phase:**
- ✅ Complete: All major directory READMEs, 6 of 8 workflow docs
- ⏳ NEXT: Complete remaining 2 workflow files, start Phase 2 (deep docs)
- ⏳ THEN: Remove old [← Back] links (grep search + replace)

**Notes:**
- No blockers
- Navigation format working well
- Abbreviated format for deep nesting works great
- Ready for new session to continue with last 2 workflow files
```

Commit: `git commit -am "docs: End of session - Navigation Phase 1 at 13/15"`

---

## Git Commit Message Patterns

**For checkpoints:**
- `checkpoint: 11/15 navigation files complete`
- `checkpoint: Added navigation to workflows`
- `checkpoint: Navigation Phase 1 halfway done`

**For session updates:**
- `docs: Update session context - 11/15 files complete`
- `docs: Add navigation depth decision`
- `docs: Note blocker with nested navigation`

**For end of session:**
- `docs: End of session - Navigation Phase 1 at 13/15`
- `docs: Session handoff ready - Navigation mostly complete`

---

## Quick Decision: Which Update Type?

| Situation | Update Type | Time |
|-----------|-------------|------|
| Finished 1-3 files | Quick checkpoint | 30 sec |
| Every 30-60 minutes | Quick checkpoint | 30 sec |
| Before break/lunch | Quick checkpoint | 1 min |
| Completed major feature | Full update | 2-3 min |
| Made architectural decision | Full update + DECISION_LOG | 3-5 min |
| Discovered blocker | Full update | 2 min |
| End of work day | Full update | 2-3 min |

---

## Troubleshooting Updates

### "I forgot what I did since last update"

Check git log:
```powershell
git log --oneline --since="2 hours ago"
```

Look at changed files:
```powershell
git status
git diff --name-only HEAD~5
```

### "Not sure if this counts as 'significant'"

**Ask yourself:**
- Would I want a new AI session to know about this? → Yes = Update
- Did this take >30 minutes of work? → Yes = Update
- Is this a decision or change of direction? → Yes = Update + maybe DECISION_LOG
- Just routine file edits following established pattern? → Quick checkpoint is fine

### "Session_CONTEXT.md is getting too long"

**That's fine!** It's supposed to grow. When it gets really long:
1. Archive old "Recent Major Changes" (move items >30 days to bottom or separate archive file)
2. Keep "What We're Working On" current and concise
3. Full file can be 500-1000 lines, that's OK

---

## Remember

**The goal:** If session ends unexpectedly, new AI can pick up with minimal loss

**Minimum protection:** Update before breaks and end of day  
**Good protection:** Quick checkpoint every 30-60 minutes  
**Maximum protection:** Update after every completed item  

**Time investment:** 30 seconds to 3 minutes  
**Time saved on session recovery:** 10-30 minutes  

**It's insurance - worth it!** 🎯

---

## Related Files

- [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) - The file you're updating
- [SESSION_HANDOFF_GUIDE.md](./SESSION_HANDOFF_GUIDE.md) - Complete session handoff process
- [NEW_SESSION_PROMPT_TEMPLATE.md](./NEW_SESSION_PROMPT_TEMPLATE.md) - Starting new AI sessions
- [MAINTENANCE_ROUTINE.md](./MAINTENANCE_ROUTINE.md) - Daily/weekly maintenance

---

[⬆ Back to top](#session-context-update-template) | [🏠 AGOG Home](../README.md) | [📋 Session Context](./SESSION_CONTEXT.md)
