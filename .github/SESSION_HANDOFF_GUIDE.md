**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → Session Handoff Guide

# Session Handoff Guide

> **🎯 Purpose:** Quick reference for ending current session and starting new AI session  
> **⏱️ Time Required:** ~5 minutes  
> **📅 Use When:** Switching AI sessions, hitting token limits, or ending work day

---

## Quick Summary

**The Problem:** AI sessions end (token limits, etc.) and new sessions lose context.

**The Solution:** We built a session recovery system. Follow these steps to hand off seamlessly.

**The Result:** New AI picks up exactly where you left off. Zero re-explanation.

---

## 📤 Before Ending Current Session (3 minutes)

### Step 1: Update SESSION_CONTEXT.md

Open `.github/SESSION_CONTEXT.md` and update:

1. **Top section:**
   ```markdown
   > **🔄 Last Updated:** [TODAY'S DATE]
   > **📊 Session Status:** [Handoff ready | Completed X]
   ```

2. **"What We're Working On RIGHT NOW":**
   - Mark completed items as ✅
   - Update in-progress items (what's the current state?)
   - Add ⏳ NEXT: [what should happen next]

3. **"Recent Major Changes":**
   - Add today's work to the top of the list
   - Format: `### [Feature Name] (2025-MM-DD)`

4. **"Known Blockers":**
   - Any issues the new session should know about?
   - If none: keep "None - Development proceeding smoothly"

**Example Update:**
```markdown
## What We're Working On RIGHT NOW

### Primary Focus: Navigation Path System
**Status:** Phase 1 - 9 of 15 files complete ✅
**Next:** Add navigation to workflows/*.md files
**Timeline:** On track for 2025-11-15

**Current Phase:**
- ✅ Complete: All README files in major directories
- ⏳ NEXT: Deep documentation files (workflows, integrations)
```

### Step 2: Commit & Push

```powershell
# Add all changes
git add .

# Commit with descriptive message
git commit -m "docs: Update session context - Navigation Path Phase 1 at 9/15 files"

# Push to GitHub
git push origin feature
```

**That's it for ending!** Session is ready for handoff.

---

## 📥 Starting New AI Session (2 minutes)

### Step 1: Open New Copilot Chat

Start a fresh GitHub Copilot chat session.

### Step 2: Send Onboarding Prompt

**Copy/paste this to the new AI:**

```
I'm Todd, working on the AGOG Print Industry ERP project. This is a new session.

Please start by reading these files in order:
1. .github/AI_ONBOARDING.md (quick start - 5 min read)
2. .github/SESSION_CONTEXT.md (current state - 3 min read)
3. CONSTRAINTS.md (hard rules - 2 min read)

After reading those three files, please tell me:
1. What were we working on?
2. What's the next task?
3. Any questions or concerns?
```

### Step 3: Wait for AI Response

The AI will:
1. Read the three files (~10 min reading)
2. Understand project context
3. Know current work state
4. Understand all constraints
5. Respond with summary and next steps

**Expected response:**
```
"We were working on Navigation Path system rollout, Phase 1. 
Currently at 9 of 15 files complete. 

Next task: Add navigation to workflow/*.md files (Project Architecture/workflows/).

Pattern to follow: Top navigation + bottom navigation with horizontal rule.

No blockers noted. Ready to continue!"
```

### Step 4: Confirm and Continue

**You say:** "Perfect! Let's continue with the workflows."

**And you're back to work!** 🚀

---

## 🔄 Updating Session Recovery Files

### When to Update Each File

| File | When to Update | Frequency |
|------|---------------|-----------|
| **SESSION_CONTEXT.md** | End of work session, major progress | Daily |
| **DECISION_LOG.md** | Made architectural/design decision | As needed |
| **CONSTRAINTS.md** | New hard rule or constraint changed | Rare |
| **AI_ONBOARDING.md** | Project fundamentals changed | Very rare |

### How to Update SESSION_CONTEXT.md (Most Common)

**Daily updates (2 minutes):**

1. **Update date and status:**
   ```markdown
   > **🔄 Last Updated:** 2025-10-31
   > **📊 Session Status:** Active - [current work]
   ```

2. **Update "What We're Working On RIGHT NOW":**
   - Change "🚧 In Progress" to "✅ Complete" when done
   - Add new "⏳ NEXT:" items
   - Update progress counts (9 of 15 files, etc.)

3. **Add to "Recent Major Changes"** (if significant work done today):
   ```markdown
   ### [Feature/Change Name] (YYYY-MM-DD)
   **What:** Brief description
   **Why:** Reason for change
   **Impact:** What this affects
   **Files:** List of key files
   ```

4. **Update "Known Blockers"** (if any issues):
   ```markdown
   ### Current Blockers
   **Issue:** Description
   **Impact:** What's blocked
   **Plan:** How to resolve
   ```

### How to Update DECISION_LOG.md (As Needed)

**When you make a significant decision:**

1. Add new entry at top of "Recent Decisions" section
2. Use this format:
   ```markdown
   ### Decision Title
   **Date:** YYYY-MM-DD
   **Decider:** Todd + AI Assistant
   **Status:** Active

   **Context:** What led to this decision?

   **Decision:** What did we decide?

   **Rationale:** Why this choice?

   **Alternatives Considered:**
   - Option A: Why rejected
   - Option B: Why rejected

   **Impact:** What changes?

   **Related Decisions:** Link to related entries
   ```

### How to Update CONSTRAINTS.md (Rare)

**When adding a new hard rule:**

1. Choose appropriate section (PostgreSQL, Multi-Tenant, etc.)
2. Add new constraint using format:
   ```markdown
   ### ✅ MUST [DO/USE/HAVE]: [Constraint Name]

   **Rule:** Clear statement of the constraint

   **Rationale:**
   - Reason 1
   - Reason 2

   **Impact:**
   - What this affects
   - What must change

   **Examples:**
   ```sql
   -- ✅ CORRECT
   [good example]

   -- ❌ WRONG
   [bad example]
   ```
   ```

3. Update DECISION_LOG.md to explain WHY the constraint was added

---

## ⚠️ Common Mistakes to Avoid

### ❌ Don't Do This:
- Skip updating SESSION_CONTEXT.md before ending session
- Forget to commit/push before closing session
- Start new session without reading the three files
- Make architectural decisions without updating DECISION_LOG.md
- Violate CONSTRAINTS.md without documenting why

### ✅ Do This Instead:
- Always update SESSION_CONTEXT.md (part of MAINTENANCE_ROUTINE.md daily checklist)
- Always commit/push before ending session
- Always read AI_ONBOARDING → SESSION_CONTEXT → CONSTRAINTS in new sessions
- Always document significant decisions in DECISION_LOG.md
- If violating constraint, document in DECISION_LOG.md and update CONSTRAINTS.md

---

## 🎯 Quick Checklist

### Before Ending Session
- [ ] Updated SESSION_CONTEXT.md with current state
- [ ] Added today's work to "Recent Major Changes" (if significant)
- [ ] Updated "What We're Working On RIGHT NOW"
- [ ] Noted any blockers
- [ ] Committed changes: `git add . && git commit -m "docs: Update session context"`
- [ ] Pushed to GitHub: `git push origin feature`

### Starting New Session
- [ ] Opened new Copilot chat
- [ ] Sent onboarding prompt (with 3 files to read)
- [ ] Waited for AI to read and respond
- [ ] Confirmed AI understands current state
- [ ] Ready to continue work!

---

## 🆘 Troubleshooting

### "New AI doesn't understand the project"
**Solution:** Did the AI read AI_ONBOARDING.md? Explicitly ask: "Did you read .github/AI_ONBOARDING.md?"

### "New AI doesn't know what we were working on"
**Solution:** Check if SESSION_CONTEXT.md was updated before ending last session. If not, update it now and ask AI to re-read.

### "New AI is violating constraints"
**Solution:** Ask: "Did you read CONSTRAINTS.md? We have hard rules about [specific constraint]."

### "Session updates taking too long"
**Solution:** You're overthinking it! SESSION_CONTEXT.md update should take 2 minutes. Just update:
1. Date/status
2. Mark items complete
3. Add NEXT item
4. Commit/push

---

## 📊 Success Metrics

**You'll know it's working when:**
- ✅ New AI sessions start productive immediately
- ✅ No time spent re-explaining project
- ✅ AI understands constraints without reminders
- ✅ AI can pick up mid-task without confusion
- ✅ Session handoffs take <5 minutes total

**You'll know it needs improvement when:**
- ❌ Spending >10 minutes getting new AI up to speed
- ❌ Having to re-explain decisions
- ❌ AI violating constraints repeatedly
- ❌ Confusion about current work state

**If the system is failing:** Simplify it! The goal is efficiency, not perfection.

---

## 📚 Related Documentation

- [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) - Current project state
- [AI_ONBOARDING.md](./AI_ONBOARDING.md) - New AI quick start
- [DECISION_LOG.md](./DECISION_LOG.md) - WHY we made decisions
- [CONSTRAINTS.md](../CONSTRAINTS.md) - Hard rules
- [MAINTENANCE_ROUTINE.md](./MAINTENANCE_ROUTINE.md) - Daily/weekly checklists

---

## 💡 Pro Tips

1. **Update SESSION_CONTEXT.md throughout the day** - Don't wait until end of session
2. **Use SESSION_CONTEXT.md as your working notes** - It helps YOU stay organized too
3. **Be honest about blockers** - New AI can't help if it doesn't know there's an issue
4. **Keep "What We're Working On" updated** - It's the most important section
5. **Commit often** - Don't lose work if session crashes

---

**Remember: The 5 minutes you spend on session handoff saves hours of re-explanation!**

---

[⬆ Back to top](#session-handoff-guide) | [🏠 AGOG Home](../README.md) | [📋 Session Context](./SESSION_CONTEXT.md)
