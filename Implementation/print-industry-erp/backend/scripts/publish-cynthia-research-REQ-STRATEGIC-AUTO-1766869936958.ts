import { connect, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

async function publishResearchDeliverable() {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const sc = StringCodec();

  const deliverablePath = path.join(
    __dirname,
    '..',
    '..',
    'backend',
    'CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1766869936958.md'
  );

  const researchContent = fs.readFileSync(deliverablePath, 'utf-8');

  const payload = {
    agent: 'cynthia',
    reqNumber: 'REQ-STRATEGIC-AUTO-1766869936958',
    featureTitle: 'PO Approval Workflow',
    deliverableType: 'research',
    status: 'COMPLETE',
    timestamp: new Date().toISOString(),
    assignedTo: 'marcus',
    content: researchContent,
    summary: 'Comprehensive research on PO approval workflow enhancement - multi-level approval chains, business rules, audit trails, and implementation roadmap for Marcus',
    keyFindings: [
      'Existing single-level approval infrastructure in place with database schema and GraphQL API',
      'Critical gaps: multi-level approval chains, business rule engine, rejection workflow, audit trail, notifications',
      'Reference patterns available: sales quote approval, vendor alert workflow, workflow state table',
      'Recommended approach: 5 implementation sprints over 3-4 weeks',
      'Database schema designed with 7 new tables for comprehensive approval workflow',
      'Service layer architecture defined with PoApprovalWorkflowService',
      'GraphQL schema extensions specified with new queries and mutations',
      'Frontend components identified: ApprovalChainTimeline, ApprovalDecisionModal, MyApprovalsPage',
    ],
    recommendations: [
      'Start with Sprint 1: Database migration V0.0.35 and core PoApprovalWorkflowService',
      'Implement multi-level approval chains with role-based routing',
      'Build complete audit trail with po_approval_history table',
      'Create business rule engine for automatic approval requirement evaluation',
      'Add delegation system for backup approvers',
      'Implement notifications and escalation for pending approvals',
      'Follow existing patterns from quote approval and vendor alert workflows',
    ],
    files: [
      'print-industry-erp/backend/CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1766869936958.md',
    ],
    references: {
      existingCode: [
        'print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql',
        'print-industry-erp/backend/src/graphql/schema/sales-materials.graphql',
        'print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts',
        'print-industry-erp/backend/src/modules/sales/services/quote-management.service.ts',
        'print-industry-erp/backend/src/modules/procurement/services/vendor-alert-engine.service.ts',
        'print-industry-erp/frontend/src/pages/PurchaseOrderDetailPage.tsx',
      ],
      newFilesRequired: [
        'print-industry-erp/backend/migrations/V0.0.35__enhance_po_approval_workflow.sql',
        'print-industry-erp/backend/src/modules/procurement/services/po-approval-workflow.service.ts',
        'print-industry-erp/backend/src/graphql/resolvers/po-approval.resolver.ts',
        'print-industry-erp/frontend/src/components/common/ApprovalChainTimeline.tsx',
        'print-industry-erp/frontend/src/components/common/ApprovalDecisionModal.tsx',
        'print-industry-erp/frontend/src/pages/MyApprovalsPage.tsx',
      ],
    },
    metrics: {
      linesOfResearch: researchContent.split('\n').length,
      tablesDesigned: 7,
      apiEndpointsSpecified: 8,
      referenceFilesAnalyzed: 12,
      estimatedImplementationWeeks: 4,
    },
  };

  // Publish to main deliverable subject
  nc.publish(
    'agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1766869936958',
    sc.encode(JSON.stringify(payload, null, 2))
  );

  console.log('✅ Published research deliverable to NATS:');
  console.log('   Subject: agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1766869936958');
  console.log(`   Requirement: ${payload.reqNumber}`);
  console.log(`   Feature: ${payload.featureTitle}`);
  console.log(`   Assigned to: ${payload.assignedTo}`);
  console.log(`   Status: ${payload.status}`);
  console.log(`   Lines of research: ${payload.metrics.linesOfResearch}`);
  console.log(`   Tables designed: ${payload.metrics.tablesDesigned}`);
  console.log(`   API endpoints: ${payload.metrics.apiEndpointsSpecified}`);

  // Also publish to workflow orchestrator for next stage routing
  nc.publish(
    'agog.workflow.stage.complete',
    sc.encode(
      JSON.stringify({
        reqNumber: 'REQ-STRATEGIC-AUTO-1766869936958',
        stage: 'research',
        agent: 'cynthia',
        status: 'COMPLETE',
        nextStage: 'backend-implementation',
        assignedTo: 'marcus',
        timestamp: new Date().toISOString(),
        deliverableSubject:
          'agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1766869936958',
      })
    )
  );

  console.log('✅ Published workflow stage completion to orchestrator');

  await nc.drain();
}

publishResearchDeliverable().catch(console.error);
