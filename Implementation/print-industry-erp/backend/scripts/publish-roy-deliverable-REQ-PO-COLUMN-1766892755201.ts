#!/usr/bin/env ts-node

/**
 * NATS Publisher: Roy Backend Deliverable
 * REQ-PO-COLUMN-1766892755201 - Fix Purchase Order Column Name Mismatch
 *
 * This script publishes Roy's backend deliverable to the NATS message bus
 * for consumption by the orchestrator and other agents.
 */

import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const NATS_SERVER = process.env.NATS_SERVER || 'nats://localhost:4222';
const DELIVERABLE_PATH = path.join(__dirname, '..', 'ROY_BACKEND_DELIVERABLE_REQ-PO-COLUMN-1766892755201.md');

interface BackendDeliverable {
  agent: string;
  role: string;
  reqNumber: string;
  featureTitle: string;
  status: 'COMPLETE' | 'IN_PROGRESS' | 'BLOCKED';
  timestamp: string;
  deliverableUrl: string;
  summary: string;
  changes: {
    modified: string[];
    created: string[];
    deleted: string[];
  };
  verification: {
    databaseChanges: boolean;
    migrationRequired: boolean;
    codeChanges: boolean;
    testingRequired: boolean;
  };
  metrics: {
    filesModified: number;
    linesChanged: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  };
  nextSteps: string[];
  deliverableContent: string;
}

async function publishBackendDeliverable() {
  console.log('🚀 Publishing Roy Backend Deliverable to NATS...\n');

  try {
    // Read the deliverable markdown
    const deliverableContent = fs.readFileSync(DELIVERABLE_PATH, 'utf-8');

    // Create the deliverable payload
    const deliverable: BackendDeliverable = {
      agent: 'roy',
      role: 'Backend Developer',
      reqNumber: 'REQ-PO-COLUMN-1766892755201',
      featureTitle: 'Fix Purchase Order Column Name Mismatch',
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),
      deliverableUrl: 'nats://agog.deliverables.roy.backend.REQ-PO-COLUMN-1766892755201',
      summary: 'Successfully resolved Purchase Order column name mismatch by updating schema reference file. No runtime bug existed - database was correctly migrated, all code uses correct column names. Documentation-only fix with zero risk.',
      changes: {
        modified: [
          'print-industry-erp/backend/database/schemas/sales-materials-procurement-module.sql'
        ],
        created: [
          'print-industry-erp/backend/scripts/verify-po-column-names.sql',
          'print-industry-erp/backend/scripts/publish-roy-deliverable-REQ-PO-COLUMN-1766892755201.ts'
        ],
        deleted: []
      },
      verification: {
        databaseChanges: false,  // No database changes needed - already correct
        migrationRequired: false, // Migration V0.0.8 already applied
        codeChanges: false,       // No code changes needed - already correct
        testingRequired: true     // Verification script provided
      },
      metrics: {
        filesModified: 1,
        linesChanged: 15,
        complexity: 'LOW',
        riskLevel: 'NONE'
      },
      nextSteps: [
        'Billy (QA) to verify documentation accuracy',
        'Optional: Run verification script to confirm database state',
        'Optional: Audit other schema reference files for post-V0.0.8 accuracy',
        'Mark requirement as COMPLETE - no deployment needed'
      ],
      deliverableContent
    };

    // Connect to NATS
    console.log(`📡 Connecting to NATS server: ${NATS_SERVER}`);
    const nc = await connect({ servers: NATS_SERVER });
    const sc = StringCodec();

    // Publish to multiple subjects for routing
    const subjects = [
      'agog.deliverables.roy.backend.REQ-PO-COLUMN-1766892755201',
      'agog.deliverables.roy.backend',
      'agog.deliverables.backend',
      'agog.workflow.stage.backend.complete',
      'agog.notifications.deliverable.ready'
    ];

    console.log('\n📤 Publishing to subjects:');
    for (const subject of subjects) {
      nc.publish(subject, sc.encode(JSON.stringify(deliverable, null, 2)));
      console.log(`  ✓ ${subject}`);
    }

    // Create a completion event
    const completionEvent = {
      eventType: 'BACKEND_DELIVERABLE_COMPLETE',
      reqNumber: 'REQ-PO-COLUMN-1766892755201',
      agent: 'roy',
      timestamp: new Date().toISOString(),
      status: 'COMPLETE',
      deliverableUrl: 'nats://agog.deliverables.roy.backend.REQ-PO-COLUMN-1766892755201',
      metadata: {
        filesModified: 1,
        filesCreated: 2,
        riskLevel: 'NONE',
        requiresDeployment: false,
        requiresTesting: true
      }
    };

    nc.publish('agog.events.backend.complete', sc.encode(JSON.stringify(completionEvent, null, 2)));
    console.log(`  ✓ agog.events.backend.complete`);

    // Flush and close
    await nc.flush();
    await nc.close();

    console.log('\n✅ Backend deliverable published successfully!');
    console.log('\n📊 Deliverable Summary:');
    console.log(`   Requirement: ${deliverable.reqNumber}`);
    console.log(`   Status: ${deliverable.status}`);
    console.log(`   Risk Level: ${deliverable.metrics.riskLevel}`);
    console.log(`   Files Modified: ${deliverable.metrics.filesModified}`);
    console.log(`   Lines Changed: ${deliverable.metrics.linesChanged}`);
    console.log(`   Next Stage: QA Validation (Billy)`);
    console.log('\n🔗 Deliverable URL:');
    console.log(`   ${deliverable.deliverableUrl}`);

  } catch (error) {
    console.error('❌ Error publishing backend deliverable:', error);
    process.exit(1);
  }
}

// Execute
publishBackendDeliverable();
