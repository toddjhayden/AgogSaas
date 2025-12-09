**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → Maintenance Routine

# Project Maintenance Routine

## Purpose
This document ensures our documentation and tracking systems stay healthy. It's a **lightweight checklist** to prevent the overhead systems from becoming stale.

**Target Time:**
- Daily routine: ~5 minutes
- Weekly routine: ~15 minutes
- Monthly routine: ~30 minutes

---

## Daily Routine (End of Each Work Session)

**When to do this:** Before you stop working for the day  
**Time required:** ~5 minutes

### Checklist

- [ ] **Check TODO.md**
  - Did you complete any tasks today?
  - If yes: Mark them `[x]` in TODO.md
  - Did you identify new tasks?
  - If yes: Add them to TODO.md

- [ ] **Check GAPS.md**
  - Did you find any documentation gaps, inconsistencies, or quality issues?
  - If yes: Add them to GAPS.md using `.github/GAP_TEMPLATE.md`
  - Did you resolve any gaps?
  - If yes: Move them to "Resolved Gaps" section

- [ ] **Update metrics** (if you changed GAPS.md)
  - Update gap counts at bottom of GAPS.md
  - Update "Resolved (Last 30 Days)" count

- [ ] **Update SESSION_CONTEXT.md** (if significant work done)
  - Update "What We're Working On RIGHT NOW" section
  - Add major changes to "Recent Major Changes" section
  - Update "Next Planned Actions" if priorities changed
  - Note any new blockers discovered

**That's it!** Don't overthink it. This should take 5 minutes.

---

## Weekly Routine (Every Friday)

**When to do this:** End of day Friday  
**Time required:** ~15 minutes

### Checklist

- [ ] **Review GAPS.md - Critical & High Priority**
  - Read through all "Critical" and "High Priority" gaps
  - For each gap:
    - [ ] Does it have a target date? (Add one if missing)
    - [ ] Is it assigned? (Assign to yourself or mark "Unassigned")
    - [ ] Is it past due? (Update target date or escalate)
  - Are any gaps now resolved?
    - [ ] Move to "Resolved Gaps" section with date

- [ ] **Review TODO.md - In Progress Items**
  - Are there any `[~]` in-progress items?
  - Are they actually in progress or stuck?
  - Update status or add notes

- [ ] **Sanity check**
  - [ ] Are there any broken links in main README.md?
  - [ ] Quick scan: Do file names in TODO.md match reality?
  - [ ] Quick scan: Does GAPS.md reference files that exist?

**Weekly Review Complete!**

---

## Monthly Routine (First Friday of Month)

**When to do this:** First Friday of each month  
**Time required:** ~30 minutes

### Checklist

- [ ] **GAPS.md Full Review**
  - [ ] Read through ENTIRE GAPS.md file
  - [ ] Archive resolved items older than 30 days
    - Move to a `GAPS_ARCHIVE.md` file (create if doesn't exist)
    - Keep "Resolved Gaps" section for last 30 days only
  - [ ] Re-prioritize gaps if needed
    - Did any Medium gaps become High?
    - Did any High gaps become Critical?
  - [ ] Update metrics:
    - [ ] Total gaps count
    - [ ] Count by priority
    - [ ] Average time to resolution (if enough data)
    - [ ] Oldest open gap

- [ ] **TODO.md Full Review**
  - [ ] Archive completed tasks older than 30 days
  - [ ] Group related tasks
  - [ ] Estimate remaining work
  - [ ] Prioritize next month's tasks

- [ ] **Cross-reference check**
  - [ ] Does TODO.md list tasks that should be in GAPS.md?
  - [ ] Does GAPS.md list gaps that should be in TODO.md?
  - [ ] Are there duplicate entries?

- [ ] **Documentation health check**
  - [ ] Run through main README.md links (manual click-through)
  - [ ] Check PROJECT_INDEX.md for accuracy
  - [ ] Verify Standards/README.md links work
  - [ ] Spot-check 3-5 random internal links

**Monthly Review Complete!**

---

## When to Skip the Routine

**You can skip daily routine if:**
- You didn't write or edit any documentation today
- You didn't write any code today
- You only read/reviewed (no changes made)

**You can postpone weekly routine if:**
- It's a short week (holiday week, vacation)
- No significant work happened this week
- But don't skip more than 2 weeks in a row!

**You should NEVER skip monthly routine** - it prevents documentation rot.

---

## How to Remember to Do This

### Option 1: Calendar Reminder
Set recurring reminders:
- Daily: End of work day (5pm?)
- Weekly: Friday 4pm
- Monthly: First Friday 3pm

### Option 2: Git Hook
Create a pre-commit hook that reminds you:
```bash
# .git/hooks/pre-commit
echo "⚠️  Before committing:"
echo "1. Did you update TODO.md? (if tasks completed)"
echo "2. Did you update GAPS.md? (if gaps found/resolved)"
```

### Option 3: Start-of-Session Checklist
When you start coding each day, first check:
```
Today's session:
[ ] Read GAPS.md - what am I working on today?
[ ] Read TODO.md - what's the next task?
[ ] At end of session: update both files
```

### Option 4: AI Assistant Reminder
At end of conversation sessions, ask AI:
> "Remind me to update TODO.md and GAPS.md before we finish"

---

## Red Flags (When to Do Emergency Maintenance)

Do an **immediate** review if:
- ❌ GAPS.md hasn't been updated in 2+ weeks
- ❌ TODO.md has more than 10 completed items not marked `[x]`
- ❌ You notice 3+ broken documentation links
- ❌ Someone else can't find documentation they need
- ❌ You reference a document in code/docs that doesn't exist

---

## The "5-Minute Friday" Minimum

**If you're short on time,** do this absolute minimum every Friday:

1. Open GAPS.md
2. Scan "Critical" section
3. Ask: "Is anything critical getting worse?"
4. If yes: Fix it or escalate
5. If no: Close file

**This is the floor, not the ceiling.**

---

## Measuring Success

You'll know the system is working if:
- ✅ You can find any document in < 30 seconds
- ✅ New team members can onboard from documentation alone
- ✅ You don't discover "surprise" gaps during critical moments
- ✅ GAPS.md accurately reflects reality
- ✅ TODO.md doesn't have zombie tasks (marked complete but still listed)

You'll know the system is failing if:
- ❌ You keep rediscovering the same gaps
- ❌ GAPS.md is out of date
- ❌ You're creating documentation you can't find later
- ❌ The overhead of maintaining the system exceeds its value

**If the system is failing:** Simplify it. Remove steps. Make it easier.

---

## Evolution of This System

**This document itself should evolve:**
- If a step consistently takes too long: simplify it
- If you keep skipping a step: remove it or make it easier
- If you discover gaps not caught by this routine: add a check
- If the routine becomes burdensome: cut it down

**This is a tool, not a religion.** Adapt it to what actually works.

---

## Quick Start (First Time Using This)

**Today (Right Now):**
1. [ ] Read this entire document (5 minutes)
2. [ ] Do the "Daily Routine" checklist above
3. [ ] Set a recurring calendar reminder for Friday weekly review

**This Friday:**
1. [ ] Do the "Weekly Routine" checklist
2. [ ] Adjust the routine if anything felt burdensome

**First Friday of Next Month:**
1. [ ] Do the "Monthly Routine" checklist
2. [ ] Evaluate: Is this system helping or creating overhead?
3. [ ] Adjust as needed

---

## Related Documentation
- [GAPS.md](../GAPS.md) - Documentation quality tracking
- [TODO.md](../TODO.md) - Task tracking
- [.github/GAP_TEMPLATE.md](./GAP_TEMPLATE.md) - Template for adding gaps

---

[⬆ Back to top](#project-maintenance-routine) | [🏠 AGOG Home](../README.md)
