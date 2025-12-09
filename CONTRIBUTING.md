# Contributing to AgogSaaS

## Adding Requirements

This system is designed to have AI agents automatically implement features from requirements.

### 1. Create a Requirement Document

Create a file in the root: `REQUIREMENTS.md`

Format:
```markdown
# Requirements

## REQ-001: Feature Name
**Owner**: your-name
**Priority**: HIGH
**Status**: REQUESTED

### Description
Detailed description of what needs to be built.

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
```

### 2. Start the Orchestration Workflow

The AI agent system will automatically:
1. Research the requirement (Cynthia)
2. Critique the approach (Sylvia)
3. Implement backend (Roy)
4. Implement frontend (Jen)
5. Test everything (Billy)
6. Generate statistics (Priya)

### 3. Monitor Progress

Watch the monitoring dashboard: http://localhost:3000/monitoring

## Development Workflow

1. All code changes should go through the AI agent system
2. Pre-commit hooks will validate changes
3. The monitoring dashboard shows real-time progress
4. Agents learn from each feature and get smarter

## Manual Development (If Needed)

If you need to make manual changes:

1. Create a feature branch
2. Make your changes
3. Pre-commit hooks will run automatically
4. Create a PR
5. Review and merge

## Questions?

See the main README.md for more information.
