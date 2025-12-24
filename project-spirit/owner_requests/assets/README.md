# Owner Request Assets

This directory contains screenshots, diagrams, and other assets provided by product owners (Marcus, Sarah, Alex) to help illustrate feature requests and issues.

## Directory Structure

```
assets/
├── REQ-{DOMAIN}-{NUMBER}/
│   ├── screenshot-issue.png
│   ├── screenshot-expected.png
│   ├── diagram.png
│   └── ...
```

## Usage Guidelines

### For Product Owners

When creating a new request in `OWNER_REQUESTS.md`:

1. **Create a directory** for your request:
   ```bash
   mkdir -p project-spirit/owner_requests/assets/REQ-ITEM-MASTER-001
   ```

2. **Add your assets**:
   - Screenshots showing the issue
   - Screenshots showing expected behavior
   - Diagrams explaining the feature
   - Example data files
   - Any other visual aids

3. **Reference in your request**:
   ```markdown
   **Owner-Provided Assets**:
   - See `project-spirit/owner_requests/assets/REQ-ITEM-MASTER-001/` for screenshots
   ```

### File Naming Conventions

Use descriptive names:
- `issue-current-state.png` - What you see now
- `expected-behavior.png` - What you want to see
- `error-console.png` - Console errors
- `flow-diagram.png` - Process flow diagrams
- `mockup-ui.png` - UI mockups

### Supported Formats

- Images: `.png`, `.jpg`, `.gif`
- Diagrams: `.png`, `.svg`, `.drawio`
- Documents: `.pdf`, `.md`
- Data: `.csv`, `.json`, `.yaml`

## For Agents

When you receive a request with assets:

1. **Read the assets** using the Read tool (images will be displayed visually)
2. **Understand the issue** from the screenshots
3. **Compare** current state vs. expected state
4. **Use Playwright MCP** to verify the fix works from a user perspective

## Example

For `REQ-INFRA-DASHBOARD-001`, the owner would:

1. Take screenshot of broken dashboard
2. Save as `project-spirit/owner_requests/assets/REQ-INFRA-DASHBOARD-001/broken-dashboard.png`
3. Add to request: "See `project-spirit/owner_requests/assets/REQ-INFRA-DASHBOARD-001/` for screenshots of the issue"

Agents (especially Billy for QA) will review the screenshots and use Playwright MCP to verify the fix.
