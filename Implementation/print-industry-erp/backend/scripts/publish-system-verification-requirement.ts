#!/usr/bin/env ts-node
/**
 * Publish System Verification Requirements to NATS
 * REQ-SYSTEM-VERIFICATION-001
 *
 * P0 tasks for ROY, JEN, and BERRY to verify entire system after database fix
 */

import { connect, NatsConnection } from 'nats';

interface Requirement {
  reqId: string;
  timestamp: number;
  title: string;
  priority: string;
  status: string;
  category: string;
  owner: string;
  assignedTo: string;
  businessValue: string;
  generatedBy: string;
  generatedAt: string;
  requirements: string[];
  context: any;
}

async function publishToNats() {
  // Connect to NATS on localhost (running in Docker on port 4223)
  const natsUrl = 'localhost:4223';
  const user = process.env.NATS_USER || 'agents';
  const pass = process.env.NATS_PASSWORD || 'WBZ2y-PeJGSt2N4e_QNCVdnQNsn3Ld7qCwMt_3tDDf4';

  console.log(`Connecting to NATS at ${natsUrl}...`);
  const nc: NatsConnection = await connect({
    servers: natsUrl,
    user,
    pass,
    name: 'system-verification-publisher'
  });

  console.log('✅ Connected to NATS\n');

  const timestamp = Date.now();

  // ROY - Backend Verification
  const royRequirement: Requirement = {
    reqId: 'REQ-SYSTEM-VERIFICATION-BACKEND-001',
    timestamp,
    title: 'Backend System Verification After Database Fix',
    priority: 'P0',
    status: 'PENDING',
    category: 'VERIFICATION',
    owner: 'system',
    assignedTo: 'ROY',
    businessValue: 'Critical: Verify backend is fully operational after database startup fix and port migration (4000→4001). Ensure all GraphQL resolvers, database connections, and modules are working correctly.',
    generatedBy: 'system-health-monitor',
    generatedAt: new Date(timestamp).toISOString(),
    requirements: [
      'Verify backend container (agogsaas-app-backend) is running on port 4001',
      'Test GraphQL endpoint at http://localhost:4001/graphql',
      'Verify database connection to PostgreSQL (agogsaas-app-postgres) on port 5433',
      'Test health endpoint at http://localhost:4001/health',
      'Verify all 14 NestJS modules loaded successfully (check logs)',
      'Test sample GraphQL queries (lots, materials, inventory, forecasting)',
      'Verify GraphQL introspection is working',
      'Check for any error messages in backend logs',
      'Verify migrations ran successfully (check database schema)',
      'Test at least 3 different GraphQL resolvers to ensure they return data',
      'Update NATS database with verification results',
      'Document any issues found and their resolutions'
    ],
    context: {
      changes: [
        'Database container was fixed (was failing to start)',
        'Backend port changed from 4000 to 4001 (port conflict)',
        'Node.js upgraded from 18 to 20',
        'Package.json dependencies fixed (apollo-server conflicts)',
        'Docker volumes fixed (node_modules mount removed)'
      ],
      verificationEndpoints: {
        graphql: 'http://localhost:4001/graphql',
        health: 'http://localhost:4001/health',
        database: 'postgresql://agogsaas_user@localhost:5433/agogsaas'
      },
      expectedModules: [
        'AppModule', 'DatabaseModule', 'ConfigModule',
        'SalesModule', 'OperationsModule', 'FinanceModule',
        'TenantModule', 'QualityModule', 'HealthModule',
        'WmsModule', 'ProcurementModule', 'ForecastingModule',
        'GraphQLModule'
      ]
    }
  };

  // JEN - Frontend Verification
  const jenRequirement: Requirement = {
    reqId: 'REQ-SYSTEM-VERIFICATION-FRONTEND-001',
    timestamp,
    title: 'Frontend System Verification After Backend Port Change',
    priority: 'P0',
    status: 'PENDING',
    category: 'VERIFICATION',
    owner: 'system',
    assignedTo: 'JEN',
    businessValue: 'Critical: Verify frontend is connecting to backend correctly after port change (4000→4001). Ensure all GraphQL queries work and UI components render properly.',
    generatedBy: 'system-health-monitor',
    generatedAt: new Date(timestamp).toISOString(),
    requirements: [
      'Verify frontend container (agogsaas-app-frontend) is running on port 3000',
      'Confirm frontend .env has correct backend URL (http://localhost:4001)',
      'Test frontend loads at http://localhost:3000',
      'Verify GraphQL queries connect to backend successfully',
      'Test at least 5 different pages/routes for functionality',
      'Check browser console for any GraphQL connection errors',
      'Verify Apollo Client is configured with correct endpoint',
      'Test data fetching on key pages (Dashboard, Inventory, Reports)',
      'Verify no hardcoded references to port 4000 in frontend code',
      'Check for any CORS or connection errors in network tab',
      'Update NATS database with verification results',
      'Document any UI issues or connection problems found'
    ],
    context: {
      changes: [
        'Backend port changed from 4000 to 4001',
        'Frontend .env updated to point to new backend port',
        'docker-compose.app.yml updated with new port mapping'
      ],
      verificationUrls: {
        frontend: 'http://localhost:3000',
        backendGraphQL: 'http://localhost:4001/graphql'
      },
      keyPagesToTest: [
        'Executive Dashboard',
        'Operations Dashboard',
        'Bin Utilization Dashboard',
        'Purchase Orders Page',
        'Inventory Forecasting Dashboard'
      ]
    }
  };

  // BERRY - DevOps Verification
  const berryRequirement: Requirement = {
    reqId: 'REQ-SYSTEM-VERIFICATION-DEVOPS-001',
    timestamp,
    title: 'DevOps Infrastructure Verification and Documentation',
    priority: 'P0',
    status: 'PENDING',
    category: 'VERIFICATION',
    owner: 'system',
    assignedTo: 'BERRY',
    businessValue: 'Critical: Verify all containers (app stack AND agent stack) are running correctly. Document the complete setup, commit fixes, and update NATS database with comprehensive infrastructure status.',
    generatedBy: 'system-health-monitor',
    generatedAt: new Date(timestamp).toISOString(),
    requirements: [
      'Verify ALL containers in docker-compose.app.yml are running (frontend, backend, postgres)',
      'Verify ALL containers in docker-compose.agents.yml are running (nats, agent-postgres, ollama, agent-backend)',
      'Document complete container architecture in ARCHITECTURE.md or similar',
      'Verify port mappings are correct and documented',
      'Test connectivity between containers (backend→postgres, frontend→backend)',
      'Review and document the database fix that was applied',
      'Create deployment documentation for the port change (4000→4001)',
      'Verify NATS is accessible and agents can publish/subscribe',
      'Check docker logs for all containers - document any warnings/errors',
      'Create health check script that verifies entire system',
      'Update docker-compose files with proper health checks',
      'Commit all fixes to git with proper commit message',
      'Update OWNER_REQUESTS.md with infrastructure status',
      'Update NATS database with complete verification results including all container statuses',
      'Create DEPLOYMENT_QUICK_START.md if not exists, or update with new port info'
    ],
    context: {
      appStack: {
        file: 'docker-compose.app.yml',
        services: ['frontend:3000', 'backend:4001', 'postgres:5433']
      },
      agentStack: {
        file: 'docker-compose.agents.yml',
        services: ['nats:4223', 'agent-postgres:5434', 'ollama:11434', 'agent-backend:4002']
      },
      changes: [
        'Database container fixed (exit code 127 → healthy)',
        'Backend port changed 4000 → 4001 (port conflict resolution)',
        'Node.js 18 → 20 in Dockerfile',
        'Package.json dependencies fixed',
        'docker-compose.app.yml node_modules volumes removed'
      ],
      filesModified: [
        'Implementation/print-industry-erp/backend/Dockerfile',
        'Implementation/print-industry-erp/backend/package.json',
        'Implementation/print-industry-erp/docker-compose.app.yml',
        'Implementation/print-industry-erp/frontend/.env'
      ]
    }
  };

  // Publish all three requirements
  const requirements = [
    { req: royRequirement, subject: 'agog.requirements.backend.verification' },
    { req: jenRequirement, subject: 'agog.requirements.frontend.verification' },
    { req: berryRequirement, subject: 'agog.requirements.devops.verification' }
  ];

  console.log('📤 Publishing verification requirements to NATS...\n');

  for (const { req, subject } of requirements) {
    nc.publish(subject, JSON.stringify(req, null, 2));
    console.log(`✅ Published: ${req.reqId}`);
    console.log(`   Assigned To: ${req.assignedTo}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Requirements: ${req.requirements.length} tasks`);
    console.log('');
  }

  await nc.flush();
  await nc.close();
  console.log('✅ NATS connection closed\n');
}

if (require.main === module) {
  publishToNats()
    .then(() => {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('✅ SYSTEM VERIFICATION REQUIREMENTS PUBLISHED');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      console.log('📋 Tasks Assigned:');
      console.log('   • ROY (Backend):  Verify backend + GraphQL + database');
      console.log('   • JEN (Frontend): Verify frontend + Apollo + UI pages');
      console.log('   • BERRY (DevOps): Verify all containers + document + commit');
      console.log('');
      console.log('💾 All agents instructed to update NATS database with results');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Publication failed:', error);
      process.exit(1);
    });
}

export { publishToNats };
