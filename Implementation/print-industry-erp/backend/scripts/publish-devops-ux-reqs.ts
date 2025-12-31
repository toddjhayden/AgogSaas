/**
 * Publish DevOps/Infrastructure UX Requirements
 *
 * These REQs create React pages for deployment management features
 * that currently exist only as standalone HTML forms in deployment/forms/
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connect, StringCodec } from 'nats';

const sc = StringCodec();

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4223';
const NATS_USER = process.env.NATS_USER;
const NATS_PASSWORD = process.env.NATS_PASSWORD;

interface DevOpsREQ {
  reqNumber: string;
  title: string;
  priority: string;
  route: string;
  sourceFile: string;
  description: string;
  acceptanceCriteria: string[];
  assignedAgents: string[];
}

const DEVOPS_UX_REQS: DevOpsREQ[] = [
  {
    reqNumber: `REQ-DEVOPS-EDGE-PROVISION-${Date.now()}`,
    title: 'Edge Computer Provisioning Page',
    priority: 'P1',
    route: '/admin/edge/provision',
    sourceFile: 'deployment/forms/edge-provisioning.html',
    description: `
## Overview
Convert the standalone edge-provisioning.html to a React page integrated into the main application.

## Features Required
1. **Hardware Selection** - Raspberry Pi ($600), Intel NUC ($1,200), Dell Server ($3,000)
2. **Facility Information** - Name, address, shipping address
3. **Network Configuration** - IP, subnet, gateway, DNS
4. **VPN Configuration** - WireGuard/IPsec/OpenVPN selection
5. **IT Contact** - Name, email, phone for setup instructions

## Integration Points
- Backend API: POST /api/edge/provision
- NATS: Publish to agog.edge.provision.new
- Database: Store in edge_facilities table

## Reference
See deployment/forms/edge-provisioning.html for complete UI/UX design.
    `.trim(),
    acceptanceCriteria: [
      'Hardware pricing cards match original design',
      'Form validation for all required fields',
      'VPN type selection works correctly',
      'Submission triggers backend provisioning API',
      'Success/error feedback shown to user',
      'Mobile responsive layout'
    ],
    assignedAgents: ['cynthia', 'jen', 'roy', 'billy']
  },
  {
    reqNumber: `REQ-DEVOPS-DEPLOY-APPROVAL-${Date.now()}`,
    title: 'Deployment Approval Workflow Page',
    priority: 'P1',
    route: '/admin/deployments/approval',
    sourceFile: 'deployment/forms/deployment-approval.html',
    description: `
## Overview
Convert deployment-approval.html to React page for Blue-Green deployment approvals.

## Features Required
1. **Deployment Info** - Version, ID, regions, rollout strategy
2. **Changes Summary** - Commits since last deployment
3. **Pre-Deployment Checklist** - 8 required items before approval
4. **Timeline View** - US-EAST -> EU-CENTRAL -> APAC schedule
5. **Approve/Reject Actions** - With confirmation dialogs

## Integration Points
- Backend API: GET /api/deployments/pending, POST /api/deployments/:id/approve
- NATS: Subscribe to agog.deployments.pending
- WebSocket: Real-time deployment status updates

## Reference
See deployment/forms/deployment-approval.html for complete UI/UX design.
    `.trim(),
    acceptanceCriteria: [
      'Checklist requires all items checked before approve enabled',
      'Changes list shows all commits since last deploy',
      'Approve triggers deployment automation',
      'Reject prompts for reason and notifies team',
      'Timeline shows sequential region rollout',
      'Real-time status updates via WebSocket'
    ],
    assignedAgents: ['cynthia', 'jen', 'roy', 'billy']
  },
  {
    reqNumber: `REQ-DEVOPS-ROLLBACK-${Date.now()}`,
    title: 'Rollback Decision Page',
    priority: 'P1',
    route: '/admin/deployments/rollback',
    sourceFile: 'deployment/forms/rollback-decision.html',
    description: `
## Overview
Convert rollback-decision.html to React page for critical incident response.

## Features Required
1. **Deployment Status** - Current env, rollback target, affected regions
2. **Impact Assessment** - Active users, transactions at risk
3. **Data Loss Warning** - Replication status, sync lag
4. **Rollback Reason** - Required text field (min 20 chars)
5. **Pre-Rollback Checklist** - 6 required items
6. **Execute/Cancel Actions** - With confirmation

## Integration Points
- Backend API: POST /api/deployments/:id/rollback
- NATS: Publish to agog.deployments.rollback
- PagerDuty: Trigger incident on rollback

## Reference
See deployment/forms/rollback-decision.html for complete UI/UX design.
    `.trim(),
    acceptanceCriteria: [
      'Red alert styling for critical decision',
      'Data loss warning prominently displayed',
      'Checklist + reason required before rollback enabled',
      'Execute triggers blue-green switch',
      'Audit log captures rollback details',
      'Stakeholder notifications sent automatically'
    ],
    assignedAgents: ['cynthia', 'jen', 'roy', 'billy']
  },
  {
    reqNumber: `REQ-DEVOPS-EDGE-MONITORING-${Date.now()}`,
    title: 'Edge Computer Monitoring Dashboard',
    priority: 'P1',
    route: '/admin/edge/monitoring',
    sourceFile: 'deployment/monitoring/grafana/dashboards/json/agogsaas-edge.json',
    description: `
## Overview
Create React dashboard for monitoring edge computers at facilities.

## Features Required
1. **Facility Grid** - All edge computers with status indicators
2. **Per-Facility Metrics**:
   - Online/offline status (green/red)
   - CPU, memory, disk usage gauges
   - Last sync time (alert if > 5 min)
   - PostgreSQL connection status
   - Production data capture rate
3. **Sync Lag Timeline** - Historical sync delay chart
4. **Alerts Panel** - Facilities with issues

## Integration Points
- GraphQL: query edgeFacilities { id, status, cpu, memory, disk, lastSync }
- WebSocket: Real-time facility status updates
- NATS: Subscribe to agog.edge.*.health

## Reference
See deployment/monitoring/grafana/dashboards/json/agogsaas-edge.json for metrics.
    `.trim(),
    acceptanceCriteria: [
      'Grid shows all facilities with color-coded status',
      'Click facility opens detail panel',
      'CPU/memory/disk gauges with thresholds',
      'Sync lag chart shows last 24 hours',
      'Alerts for offline > 5 minutes',
      'Auto-refresh every 30 seconds'
    ],
    assignedAgents: ['cynthia', 'jen', 'roy', 'billy']
  },
  {
    reqNumber: `REQ-DEVOPS-DB-PERF-${Date.now()}`,
    title: 'Database Performance Dashboard',
    priority: 'P2',
    route: '/admin/infrastructure/database',
    sourceFile: 'deployment/monitoring/grafana/dashboards/json/agogsaas-database.json',
    description: `
## Overview
Create React dashboard for PostgreSQL database performance monitoring.

## Features Required
1. **Connection Pool** - Active, idle, waiting connections
2. **Slow Queries** - Top 10 queries > 1 second
3. **Replication Lag** - Blue-Green sync delay
4. **Cache Hit Ratio** - Target > 95%
5. **Transaction Rate** - Commits/rollbacks per second
6. **Table Sizes** - Largest tables with index usage

## Integration Points
- GraphQL: query databaseMetrics { connections, slowQueries, replicationLag }
- Backend: pg_stat_activity, pg_stat_statements views

## Reference
See deployment/monitoring/grafana/dashboards/json/agogsaas-database.json for metrics.
    `.trim(),
    acceptanceCriteria: [
      'Connection pool visualization with thresholds',
      'Slow query list with execution plan links',
      'Replication lag gauge with warning at 60s',
      'Cache hit ratio trend chart',
      'Transaction rate line chart',
      'Table size treemap visualization'
    ],
    assignedAgents: ['cynthia', 'jen', 'roy', 'billy']
  },
  {
    reqNumber: `REQ-DEVOPS-SECURITY-${Date.now()}`,
    title: 'Security Audit Dashboard',
    priority: 'P2',
    route: '/admin/security',
    sourceFile: 'deployment/monitoring/grafana/dashboards/json/agogsaas-security.json',
    description: `
## Overview
Create React dashboard for security monitoring and audit compliance.

## Features Required
1. **Failed Login Attempts** - Chart with spike detection
2. **Unauthorized Access** - Blocked requests by IP/user
3. **Vault Access Log** - Ollama/AI model access audit
4. **Chain of Custody** - Material tracking events
5. **Suspicious Activity** - Anomaly detection alerts
6. **User Activity** - Login/logout timeline

## Integration Points
- GraphQL: query securityEvents { type, user, ip, timestamp, details }
- Backend: Audit log tables
- NATS: Subscribe to agog.security.* events

## Reference
See deployment/monitoring/grafana/dashboards/json/agogsaas-security.json for metrics.
    `.trim(),
    acceptanceCriteria: [
      'Failed login spike detection (> 10/min)',
      'IP blocking recommendations',
      'Vault access requires justification logging',
      'Chain of custody timeline view',
      'Anomaly detection with ML scoring',
      'Export audit logs for compliance'
    ],
    assignedAgents: ['cynthia', 'jen', 'roy', 'billy']
  }
];

async function publishDevOpsREQs() {
  console.log('Publishing DevOps/Infrastructure UX Requirements...\n');

  const nc = await connect({
    servers: NATS_URL,
    user: NATS_USER,
    pass: NATS_PASSWORD,
  });

  console.log(`Connected to NATS at ${NATS_URL}\n`);

  for (const req of DEVOPS_UX_REQS) {
    const payload = {
      req_number: req.reqNumber,
      title: req.title,
      priority: req.priority,
      source: 'deployment-ux-gap-analysis',
      owner: 'orchestrator',
      route: req.route,
      sourceFile: req.sourceFile,
      description: req.description,
      acceptance_criteria: req.acceptanceCriteria,
      assigned_agents: req.assignedAgents,
      created_at: new Date().toISOString(),
      metadata: {
        category: 'devops-ux',
        requires_backend: true,
        requires_frontend: true,
        complexity: req.priority === 'P1' ? 'high' : 'medium'
      }
    };

    nc.publish('agog.requirements.new', sc.encode(JSON.stringify(payload)));
    console.log(`[${req.priority}] ${req.reqNumber}`);
    console.log(`    Title: ${req.title}`);
    console.log(`    Route: ${req.route}`);
    console.log(`    Agents: ${req.assignedAgents.join(', ')}`);
    console.log('');

    // Small delay between publishes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Published ${DEVOPS_UX_REQS.length} DevOps UX REQs`);
  console.log(`${'='.repeat(60)}`);
  console.log('\nP1 (Critical):');
  DEVOPS_UX_REQS.filter(r => r.priority === 'P1').forEach(r => {
    console.log(`  - ${r.title} (${r.route})`);
  });
  console.log('\nP2 (Important):');
  DEVOPS_UX_REQS.filter(r => r.priority === 'P2').forEach(r => {
    console.log(`  - ${r.title} (${r.route})`);
  });

  await nc.drain();
  await nc.close();
}

publishDevOpsREQs().catch(error => {
  console.error('Failed to publish REQs:', error);
  process.exit(1);
});
