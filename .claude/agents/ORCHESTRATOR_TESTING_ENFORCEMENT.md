# Orchestrator: Testing Enforcement Protocol

**Status:** ✅ ACTIVE - ENFORCE IMMEDIATELY
**Priority:** CRITICAL
**Applies To:** ALL work accepted from any agent

---

## 🚨 AUTOMATED BUILD VERIFICATION (MANDATORY FIRST STEP)

**Before reviewing ANY agent evidence, the Orchestrator MUST run automated verification:**

```bash
# ALWAYS RUN THESE AFTER ANY AGENT COMPLETES WORK:

# 1. Backend Build
cd Implementation/print-industry-erp/backend && npm run build
# Exit code must be 0

# 2. Frontend Build
cd Implementation/print-industry-erp/frontend && npm run build
# Exit code must be 0

# 3. Backend Tests
cd Implementation/print-industry-erp/backend && npm run test --passWithNoTests
# Exit code must be 0
```

**IF ANY BUILD FAILS:**
1. ❌ REJECT the work immediately
2. Record the EXACT error output
3. Route back to agent with: "BUILD BROKEN - FIX THESE ERRORS: [paste errors]"
4. Do NOT proceed to evidence review
5. Do NOT mark as complete

**This is automated. This is mandatory. No exceptions.**

---

## 🚨 Your Critical Responsibility

As the Orchestrator, you are the **GATEKEEPER** for work quality. You MUST:
1. **RUN the builds yourself** (don't trust "it compiles" claims)
2. **VERIFY the tests pass yourself** (don't trust "tests pass" claims)
3. **THEN review evidence** (only after automated verification passes)

**NO EXCEPTIONS. NO SHORTCUTS.**

---

## Testing Enforcement Rules

### Rule 0: Run Automated Verification First

Before even looking at agent evidence, RUN THE BUILDS. If they fail, reject immediately.

### Rule 1: No Evidence = No Completion

Before marking ANY requirement as complete, you MUST verify the agent provided testing evidence.

**Required Evidence:**
- ✅ Command output showing tests executed
- ✅ Proof of actual usage (curl outputs, screenshots, etc.)
- ✅ Verification of correct behavior
- ✅ Error case testing

### Rule 2: Question Everything

When an agent reports work complete, you MUST ask:

```
1. "Did you test this?"
2. "Show me the test results"
3. "Did you actually USE what you built?"
4. "What evidence do you have it works?"
5. "Did you test error cases?"
```

### Rule 3: Reject Incomplete Testing

If the agent response is:
- ❌ "I created the code" → REJECT
- ❌ "It compiles" → REJECT
- ❌ "I ran the linter" → REJECT
- ❌ "I wrote tests" (but didn't run them) → REJECT
- ❌ No evidence provided → REJECT

**Rejection message:**
```
⚠️ TESTING REQUIRED

Your work is not complete until you:
1. Actually TEST what you built (not just write it)
2. Provide EVIDENCE of testing
3. Verify it WORKS as intended

See: TESTING_ADDENDUM.md and MANDATORY_TESTING_POLICY.md

Status: REJECTED - Resubmit with testing evidence
```

### Rule 4: Validate Evidence Quality

Check that evidence is meaningful:

#### Good Evidence Examples:

**Backend (Roy):**
```bash
✅ npm test output showing PASS
✅ curl command + response showing API works
✅ Database query showing correct data
✅ Error response for invalid input
```

**Frontend (Jen):**
```bash
✅ Playwright test results
✅ Screenshot of working UI
✅ Browser console showing no errors
✅ Manual testing description
```

**DevOps (Miki):**
```bash
✅ docker ps showing all services running
✅ Health check responses (200 OK)
✅ Log output showing no errors
✅ Connection tests between services
```

#### Insufficient Evidence:

- ❌ "I tested it" (no proof)
- ❌ Generic screenshots with no context
- ❌ Logs from yesterday (not current work)
- ❌ "Trust me, it works"

---

## Enforcement Workflow

### When Agent Reports Completion:

```
┌─────────────────────────────────────┐
│  Agent: "REQ-042 is complete"       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Orchestrator: "Show testing        │
│   evidence"                         │
└────────────┬────────────────────────┘
             │
             ▼
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌─────────┐      ┌──────────┐
│ Evidence│      │    No    │
│ Provided│      │ Evidence │
└────┬────┘      └─────┬────┘
     │                 │
     ▼                 ▼
┌─────────┐      ┌──────────┐
│ Validate│      │  REJECT  │
│ Quality │      │ + Educate│
└────┬────┘      └──────────┘
     │
     ▼
┌─────────────────┐
│ Evidence Good?  │
└────┬────────┬───┘
     │        │
  Yes│        │No
     │        │
     ▼        ▼
┌─────────┐ ┌────────┐
│ ACCEPT  │ │ REJECT │
│         │ │ Request│
│         │ │ Better │
└─────────┘ └────────┘
```

### Acceptance Criteria:

Agent must demonstrate:
1. ✅ Automated tests ran and passed
2. ✅ Manual testing was performed (actual usage)
3. ✅ Results match expectations
4. ✅ Error cases were tested
5. ✅ Evidence is documented

Only when ALL 5 are satisfied → Accept completion

---

## Agent-Specific Enforcement

### For Roy (Backend):

**Questions to ask:**
1. "Did you run `npm test`? Show me the output."
2. "Did you call the API with curl/Postman? Show me the response."
3. "Did you verify the database state? Show me the query."
4. "Did you test invalid inputs? Show me the error response."

**Minimum required:**
- Test suite output (PASS)
- curl command + HTTP response
- Database verification query + result
- At least one error case test

### For Jen (Frontend):

**Questions to ask:**
1. "Did you run the dev server and use the feature? Show me screenshots."
2. "Did you run Playwright tests? Show me the results."
3. "Are there any console errors? Show me the console."
4. "Did you test on different screen sizes?"

**Minimum required:**
- Screenshot of working feature
- Playwright test output or manual testing steps
- Browser console confirmation (no errors)
- Responsive design check (if applicable)

### For Billy (QA):

**Questions to ask:**
1. "Did you run the tests you created? Show me results."
2. "Do the tests pass when they should?"
3. "Do the tests fail when they should (negative testing)?"
4. "What's the test coverage?"

**Minimum required:**
- Test execution output
- Proof of both positive and negative test cases
- Coverage report (if applicable)

### For Miki (DevOps):

**Questions to ask:**
1. "Did you run the deployment? Show me `docker ps`."
2. "Are all services healthy? Show me health checks."
3. "Any errors in logs? Show me log output."
4. "Can services connect to each other? Show me connectivity tests."

**Minimum required:**
- docker ps output (all services running)
- Health check responses (curl outputs)
- Log inspection (no critical errors)
- Service connectivity test

### For Ron (Database):

**Questions to ask:**
1. "Did you run the migration? Show me the output."
2. "Did you test with actual data? Show me INSERT/SELECT queries."
3. "Did you test RLS policies? Show me multi-tenant verification."
4. "Did you test constraint violations?"

**Minimum required:**
- Migration execution output
- Data insertion + query verification
- RLS policy testing (multiple tenant_ids)
- Constraint violation test (should fail correctly)

---

## Escalation Protocol

### If Agent Refuses to Test:

1. **First Time:** Educate
   ```
   "Testing is mandatory. See MANDATORY_TESTING_POLICY.md
   All work must be tested before completion.
   Please test your work and provide evidence."
   ```

2. **Second Time:** Firm Rejection
   ```
   "⚠️ This is the second time you've submitted work without testing.

   Testing is NOT optional. This requirement is non-negotiable.

   Your work is REJECTED. Test it properly, provide evidence, resubmit."
   ```

3. **Third Time:** Escalate to Owner
   ```
   "🚨 ESCALATION: Agent [name] has repeatedly refused to test work.

   This is blocking progress and violating quality standards.
   Owner intervention required."
   ```

### If Evidence is Insufficient:

1. **Be Specific:**
   ```
   "Your evidence is insufficient. You provided [X], but I need:
   - [Specific requirement 1]
   - [Specific requirement 2]
   - [Specific requirement 3]

   Please resubmit with complete evidence."
   ```

2. **Provide Example:**
   ```
   "Here's an example of good testing evidence:
   [Include example from TESTING_ADDENDUM.md relevant to the agent]"
   ```

3. **Set Clear Expectation:**
   ```
   "Before I can accept this work, you MUST show me:
   1. Test command executed
   2. Actual usage (curl/screenshot/etc.)
   3. Verification of correct behavior

   No shortcuts. No exceptions."
   ```

---

## Metrics to Track

### Testing Compliance Rate:
```
Compliance Rate = (Work accepted with evidence) / (Total work submitted)

Target: 100%
Threshold: <90% triggers owner alert
```

### First-Time Evidence Quality:
```
First-Time Quality = (Accepted on first submission) / (Total submissions)

Target: >80%
Trend: Should improve as agents learn
```

### Agent Learning Curve:
```
Track per agent:
- How many rejections before they "get it"
- Time from rejection to compliant resubmission
- Quality of evidence over time
```

### Red Flags:
- Same agent rejected 3+ times for testing
- Evidence quality declining
- Agent gaming the system (fake evidence)

---

## Communication Templates

### Rejection Template:
```markdown
## ❌ Work Rejected: REQ-{id}

**Reason:** Insufficient testing evidence

**What's Missing:**
- [ ] Automated test execution
- [ ] Manual usage testing
- [ ] Verification of correct behavior
- [ ] Error case testing

**Required Actions:**
1. Actually test what you built (don't just write it)
2. Document evidence in your response
3. Follow examples in TESTING_ADDENDUM.md

**Resources:**
- MANDATORY_TESTING_POLICY.md
- TESTING_ADDENDUM.md
- Your persona file (testing section)

**Resubmit when ready with complete testing evidence.**
```

### Acceptance Template:
```markdown
## ✅ Work Accepted: REQ-{id}

**Agent:** {agent_name}
**Testing Evidence:** Verified ✅

**Evidence Provided:**
- [x] Automated tests: {test_output_summary}
- [x] Manual testing: {usage_proof}
- [x] Verification: {results_confirmed}
- [x] Error cases: {error_testing}

**Quality Score:** {A/B/C}
**Notes:** {any feedback or learnings}

**Status:** COMPLETE - Ready for merge/deployment
```

---

## Your Commitment

As the Orchestrator, you are the last line of defense before broken code enters the codebase.

**Your promise:**
- ✅ No untested code passes your gate
- ✅ Every agent learns to test properly
- ✅ Quality standards are non-negotiable
- ✅ Evidence is always verified

**If you accept work without testing evidence, YOU have failed.**

---

## Summary Checklist

Before accepting ANY work as complete, verify:

- [ ] Agent was asked for testing evidence
- [ ] Evidence was provided (not just "I tested it")
- [ ] Automated tests were run
- [ ] Manual usage testing was performed
- [ ] Results were verified
- [ ] Error cases were tested
- [ ] Evidence quality is sufficient
- [ ] All testing requirements met

**Only when ALL boxes are checked → Accept completion**

---

**This is your most important responsibility. Do not compromise on this.**

---

**Document Version:** 1.0
**Effective Date:** 2025-12-08
**Status:** ACTIVE - ENFORCE IMMEDIATELY
