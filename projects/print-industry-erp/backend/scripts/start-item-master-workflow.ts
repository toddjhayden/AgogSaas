/**
 * Start Item Master Implementation Workflow
 *
 * This script initiates an orchestrated multi-agent workflow for
 * implementing the Item Master pattern.
 *
 * Workflow stages:
 * 1. Cynthia (Research) - Review items.yaml, understand requirements
 * 2. Sylvia (Critique) - Validate approach, approve/block
 * 3. Roy (Backend) - Create migrations V0.14-16, GraphQL schemas
 * 4. Jen (Frontend) - Create React components for item management
 * 5. Billy (QA) - Test dual-role items, multi-UOM, migrations
 * 6. Priya (Statistics) - Track workflow metrics
 */

import { OrchestratorService } from '../src/orchestration/orchestrator.service';

async function startItemMasterWorkflow() {
  console.log('🚀 Starting Item Master Implementation Workflow\n');

  const orchestrator = new OrchestratorService();

  try {
    // Initialize orchestrator
    console.log('Initializing orchestrator...');
    await orchestrator.initialize();
    console.log('✅ Orchestrator ready\n');

    // Start workflow
    const reqNumber = 'REQ-ITEM-MASTER-001';
    const title = 'Item Master Pattern Implementation';
    const assignedTo = 'marcus'; // Product owner

    console.log(`Starting workflow: ${reqNumber}`);
    console.log(`Title: ${title}`);
    console.log(`Assigned to: ${assignedTo}\n`);

    await orchestrator.startWorkflow(reqNumber, title, assignedTo);

    console.log('✅ Workflow started!');
    console.log('\nAgents will execute in sequence:');
    console.log('  1. Cynthia (Research) - 2 hour timeout');
    console.log('  2. Sylvia (Critique) - 1 hour timeout (approval gate)');
    console.log('  3. Roy (Backend) - 4 hour timeout');
    console.log('  4. Jen (Frontend) - 4 hour timeout');
    console.log('  5. Billy (QA) - 2 hour timeout');
    console.log('  6. Priya (Statistics) - 30 min timeout');

    console.log('\nMonitor progress:');
    console.log('  - Watch logs above');
    console.log('  - Check NATS streams: agog.features.*');
    console.log('  - Workflow status: orchestrator.getWorkflowStatus("' + reqNumber + '")');

    // Keep process alive to monitor workflow
    console.log('\nPress Ctrl+C to exit (workflow will continue in background)\n');

    // Poll for workflow status every 30 seconds
    const pollInterval = setInterval(async () => {
      try {
        const status = await orchestrator.getWorkflowStatus(reqNumber);
        if (status) {
          console.log(`[${new Date().toISOString()}] Workflow status: ${status.status}, Stage: ${status.currentStage + 1}/${status.stages.length} (${status.stages[status.currentStage]?.name})`);

          if (status.status === 'complete') {
            console.log('\n🎉 Workflow complete!');
            const duration = status.completedAt && status.startedAt
              ? ((status.completedAt.getTime() - status.startedAt.getTime()) / 1000 / 60).toFixed(2)
              : 'N/A';
            console.log(`Duration: ${duration} minutes`);
            clearInterval(pollInterval);
            await orchestrator.close();
            process.exit(0);
          } else if (status.status === 'blocked') {
            console.log('\n⚠️  Workflow blocked! Check agent output above.');
            clearInterval(pollInterval);
            await orchestrator.close();
            process.exit(1);
          } else if (status.status === 'failed') {
            console.log('\n❌ Workflow failed! Check agent output above.');
            clearInterval(pollInterval);
            await orchestrator.close();
            process.exit(1);
          }
        }
      } catch (error: any) {
        console.error('Error polling workflow status:', error.message);
      }
    }, 30000); // Poll every 30 seconds

  } catch (error: any) {
    console.error('❌ Workflow failed to start:', error.message);
    console.error(error.stack);
    await orchestrator.close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT. Workflow will continue in background.');
  console.log('Agents publish to NATS, so they run independently.');
  process.exit(0);
});

// Run workflow
startItemMasterWorkflow().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
