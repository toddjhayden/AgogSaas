# Monitoring Dashboard - Quick Reference Guide

**Request:** REQ-INFRA-DASHBOARD-001
**Status:** ✅ OPERATIONAL
**Last Verified:** 2025-12-21

---

## Quick Start

### 1. Launch the Dashboard

```bash
# From the Implementation directory
docker-compose up frontend backend
```

### 2. Access the Dashboard

```
http://localhost:3000/monitoring
```

---

## Dashboard Components

### System Status Card
- **Shows:** Overall system health metrics
- **Query:** `GET_SYSTEM_HEALTH`
- **Refresh:** Every 10 seconds (auto)
- **Data Source:** `monitoring.system_health` table

### Error List Card
- **Shows:** Recent system errors (last 10)
- **Query:** `GET_SYSTEM_ERRORS`
- **Refresh:** Every 10 seconds (auto)
- **Data Source:** `monitoring.system_errors` table

### Active Fixes Card
- **Shows:** Currently running automated fixes
- **Query:** `GET_ACTIVE_FIXES`
- **Refresh:** Every 10 seconds (auto)
- **Data Source:** `monitoring.active_fixes` table

### Agent Activity Card
- **Shows:** Recent agent executions and tasks
- **Query:** `GET_AGENT_ACTIVITIES`
- **Refresh:** Every 10 seconds (auto)
- **Data Source:** `monitoring.agent_activities` table

---

## Features

### Auto-Refresh
- **Default:** ON (10-second interval)
- **Toggle:** Use "Auto-refresh" button in header
- **Manual:** Click "Refresh Now" button

### Real-Time Updates
- Uses Apollo Client polling
- WebSocket subscriptions available for future enhancement
- Last update timestamp displayed in header

---

## Technical Details

### GraphQL Endpoint
```
http://backend:4000/graphql
```

### Available Queries

1. **systemHealth**
   ```graphql
   query {
     systemHealth {
       status
       uptime
       lastCheck
       services { name status }
     }
   }
   ```

2. **systemErrors**
   ```graphql
   query GetSystemErrors($limit: Int) {
     systemErrors(limit: $limit) {
       errorId
       message
       severity
       source
       timestamp
     }
   }
   ```

3. **activeFixes**
   ```graphql
   query {
     activeFixes {
       fixId
       errorId
       status
       strategy
       startedAt
       progress
     }
   }
   ```

4. **agentActivities**
   ```graphql
   query {
     agentActivities {
       activityId
       agentName
       task
       status
       startedAt
       completedAt
     }
   }
   ```

---

## File Locations

### Frontend Components
```
frontend/src/components/monitoring/
├── SystemStatusCard.tsx
├── AgentActivityCard.tsx
├── ErrorListCard.tsx
├── ActiveFixesCard.tsx
└── ErrorFixMappingCard.tsx
```

### Dashboard Page
```
frontend/src/pages/MonitoringDashboard.tsx
```

### GraphQL Queries
```
frontend/src/graphql/
├── queries/index.ts          # Central export
└── monitoringQueries.ts      # Monitoring queries
```

### Backend Services
```
backend/src/modules/monitoring/
├── services/
│   ├── health-monitor.service.ts
│   ├── error-tracking.service.ts
│   ├── agent-activity.service.ts
│   └── active-fixes.service.ts
└── graphql/
    ├── resolvers.ts
    └── schema.graphql
```

---

## Configuration

### Path Aliases
The dashboard uses these path aliases for clean imports:

```typescript
// vite.config.ts
{
  '@': './src',
  '@components': './src/components',
  '@graphql': './src/graphql'
}
```

### Import Pattern
```typescript
// Components use this pattern:
import { GET_SYSTEM_HEALTH } from '@graphql/queries';
import { SystemStatusCard } from '@components/monitoring/SystemStatusCard';
```

---

## Troubleshooting

### Dashboard Not Loading

**Problem:** Blank page or loading spinner
**Solution:**
1. Check backend is running: `docker-compose ps backend`
2. Verify GraphQL endpoint: `curl http://localhost:4001/graphql`
3. Check browser console for errors

### Import Errors

**Problem:** "Cannot find module '@graphql/queries'"
**Solution:**
1. Verify `frontend/src/graphql/queries/index.ts` exists
2. Check `vite.config.ts` has `@graphql` alias
3. Restart Vite dev server

### No Data Showing

**Problem:** Cards show "No data" or empty states
**Solution:**
1. Check if backend monitoring tables have data:
   ```sql
   SELECT * FROM monitoring.system_health;
   SELECT * FROM monitoring.system_errors;
   SELECT * FROM monitoring.agent_activities;
   ```
2. Run backend services to populate data
3. Check GraphQL resolver implementations

### Build Failures

**Problem:** `npm run build` fails with module errors
**Solution:**
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Verify TypeScript configuration is correct
3. Check for conflicting path aliases

---

## Testing

### Manual Testing Checklist

- [ ] Dashboard loads at `http://localhost:3000/monitoring`
- [ ] System Status Card displays health data
- [ ] Error List Card shows errors or "No errors"
- [ ] Active Fixes Card shows fixes or "No active fixes"
- [ ] Agent Activity Card shows recent activities
- [ ] Auto-refresh toggle works
- [ ] Manual refresh button works
- [ ] Last update timestamp changes every 10 seconds
- [ ] No console errors in browser

### GraphQL Testing

Use Apollo Studio or GraphQL Playground:
```
http://localhost:4001/graphql
```

Test each query individually to verify backend responses.

---

## Dependencies

### Required NPM Packages
```json
{
  "@apollo/client": "^3.14.0",
  "@mui/material": "^5.18.0",
  "@mui/icons-material": "^5.18.0",
  "graphql": "^16.12.0",
  "react": "^18.3.1"
}
```

All packages are installed and verified ✅

---

## Performance

### Polling Interval
- Default: 10 seconds
- Can be adjusted in component props:
  ```typescript
  useQuery(GET_SYSTEM_HEALTH, {
    pollInterval: 10000  // milliseconds
  })
  ```

### Data Limits
- Errors: Limited to 10 most recent
- Activities: Limited to 20 most recent
- Configurable via GraphQL query variables

---

## Future Enhancements

Potential improvements:
1. WebSocket subscriptions for real-time updates (replace polling)
2. Historical trend charts for errors and performance
3. Alert notifications for critical errors
4. Downloadable error reports
5. Agent performance analytics
6. Custom time range selection
7. Filtering and search capabilities

---

## Support

**For Issues:**
- Backend/GraphQL: Contact Roy (Backend PO)
- Frontend/UI: Contact Jen (Frontend PO)
- Infrastructure: Contact Miki (DevOps PO)

**Documentation:**
- Research Report: `MONITORING_DASHBOARD_DEPENDENCIES_ANALYSIS.md`
- Completion Report: `REQ-INFRA-DASHBOARD-001-COMPLETION-REPORT.md`

---

**Last Updated:** 2025-12-21
**Maintained By:** Roy (Backend PO)
