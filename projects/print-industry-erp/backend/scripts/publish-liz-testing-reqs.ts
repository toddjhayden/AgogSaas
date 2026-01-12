/**
 * Publish P0 Testing REQs for Liz (Frontend Tester)
 * These REQs trigger Liz to test critical UI/UX functionality
 */

import { connect, StringCodec } from 'nats';

const sc = StringCodec();

const testingReqs = [
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-001`,
    title: "Monitoring Dashboard - System Health Card rendering and data updates",
    priority: "P0",
    owner: "liz",
    testScope: "MonitoringDashboard.tsx + SystemStatusCard component",
    testCriteria: [
      "SystemStatusCard renders all 4 components (backend, frontend, database, NATS)",
      "Health status colors display correctly (OPERATIONAL=green, DOWN=red, DEGRADED=yellow)",
      "Auto-refresh works with 10-second poll interval when enabled",
      "Loading state shows CircularProgress spinner"
    ]
  },
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-002`,
    title: "Monitoring Dashboard - Error to REQ mapping display accuracy",
    priority: "P0",
    owner: "liz",
    testScope: "ErrorFixMappingCard.tsx",
    testCriteria: [
      "ErrorFixMappingCard loads and displays error-to-REQ mappings",
      "Status color coding works (HAS_FIX=green, BEING_FIXED=blue, NO_FIX=orange)",
      "Summary cards show correct count of errors with/without fixes",
      "Warning alert shows for errors without fixes"
    ]
  },
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-003`,
    title: "OrchestratorDashboard - Active Workflows table and lifecycle operations",
    priority: "P0",
    owner: "liz",
    testScope: "OrchestratorDashboard.tsx",
    testCriteria: [
      "Active Workflows table displays all columns correctly",
      "Workflow status chip colors display correctly",
      "Rollback workflow dialog works properly",
      "Circuit breaker reset button functions correctly"
    ]
  },
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-004`,
    title: "ExecutiveDashboard - KPI Cards and multi-facility overview",
    priority: "P0",
    owner: "liz",
    testScope: "ExecutiveDashboard.tsx",
    testCriteria: [
      "All 4 summary cards render with correct data",
      "Facility overview cards display Shanghai, Shenzhen, Beijing plants",
      "Revenue chart renders without errors",
      "Alert panel displays with correct severity levels"
    ]
  },
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-005`,
    title: "FinanceDashboard - Financial data display and error handling",
    priority: "P0",
    owner: "liz",
    testScope: "FinanceDashboard.tsx",
    testCriteria: [
      "Revenue and Profit cards load correctly",
      "P&L Summary table renders all line items",
      "Currency formatting displays correctly",
      "Error boundary handles query failures gracefully"
    ]
  },
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-006`,
    title: "InventoryForecastingDashboard - Forecasting UI interactions",
    priority: "P0",
    owner: "liz",
    testScope: "InventoryForecastingDashboard.tsx",
    testCriteria: [
      "Material autocomplete loads and accepts selection",
      "Generate Forecasts button triggers mutation properly",
      "Forecast accuracy displays with correct color coding",
      "Demand History table renders correctly"
    ]
  },
  {
    reqNumber: `REQ-LIZ-TEST-${Date.now()}-007`,
    title: "Navigation and Layout - Sidebar and Breadcrumb functionality",
    priority: "P0",
    owner: "liz",
    testScope: "Sidebar.tsx, Breadcrumb.tsx, App.tsx routing",
    testCriteria: [
      "All sidebar navigation links work correctly",
      "Breadcrumb shows correct path on all pages",
      "Page transitions work without errors",
      "Mobile responsive layout functions properly"
    ]
  }
];

async function publishTestingReqs() {
  const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
  const user = process.env.NATS_USER;
  const pass = process.env.NATS_PASSWORD;

  console.log(`Connecting to NATS at ${natsUrl}...`);

  const nc = await connect({
    servers: natsUrl,
    user,
    pass,
    name: 'liz-testing-req-publisher'
  });

  console.log('Connected to NATS');

  for (const req of testingReqs) {
    const message = {
      ...req,
      createdAt: new Date().toISOString(),
      source: 'automated-testing-queue',
      assignedAgent: 'liz',
      description: `
## Frontend Testing Required

**Test Scope:** ${req.testScope}

### Test Criteria:
${req.testCriteria.map(c => `- [ ] ${c}`).join('\n')}

### Instructions for Liz:
1. Use Playwright MCP to test this page/component
2. Document any issues found with screenshots
3. Create REQs for any bugs discovered
4. Mark test criteria as passed/failed

**Priority:** ${req.priority} - Test immediately
      `.trim()
    };

    nc.publish('agog.requirements.new', sc.encode(JSON.stringify(message)));
    console.log(`Published: ${req.reqNumber} - ${req.title}`);

    // Small delay between publishes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await nc.flush();
  await nc.close();

  console.log(`\n✅ Published ${testingReqs.length} P0 testing REQs for Liz`);
}

publishTestingReqs().catch(console.error);
