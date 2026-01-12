/**
 * Script: import-agog-memories.ts
 * Purpose: Import key learnings from AGOG project into Phase 4 memory system
 *
 * Usage: npm run import:agog-memories
 *
 * This script stores architectural decisions, KPI definitions, and industry
 * requirements from the original AGOG project so AI agents can reference them.
 */

import { MCPMemoryClient } from '../src/mcp/mcp-client.service';

const agentId = 'claude-primary';

const memories = [
  // Manufacturing Strategies
  {
    memory_type: 'architectural_decision',
    content: 'AGOG supports 8 manufacturing strategies in ONE platform: MTS (Make-to-Stock), MTO (Make-to-Order), CTO (Configure-to-Order), ETO (Engineer-to-Order), POD (Print-on-Demand), VDP (Variable Data Printing), Lean Manufacturing, and Digital Printing. Each strategy has unique workflows, KPIs, and data requirements.',
    metadata: { topic: 'manufacturing-strategies', source: 'agog-saas-conversation', priority: 'critical' }
  },

  // OEE (Most Important KPI)
  {
    memory_type: 'kpi_definition',
    content: 'Overall Equipment Effectiveness (OEE) = Availability × Performance × Quality. This is THE primary metric for packaging manufacturing. Everything ties back to maximizing OEE. Asset hierarchy: Site > Line > Work Center > Machine. Track production events with reason codes for downtime types.',
    metadata: { topic: 'oee', kpi_name: 'overall_equipment_effectiveness', source: 'agog-kpi-vendor', priority: 'critical' }
  },

  // Material Utilization (#1 Cost Driver)
  {
    memory_type: 'kpi_definition',
    content: 'Material Utilization % = (Total Area/Weight of Good Output) / (Total Area/Weight of Raw Material Input) × 100. This is the #1 cost driver in packaging. Must track trim waste, makeready waste, and web breaks separately by reason code. Track at job and shift levels.',
    metadata: { topic: 'material-waste', kpi_name: 'material_utilization', source: 'agog-kpi-packaging', priority: 'critical' }
  },

  // Total Asset Utilization (Strategic KPI)
  {
    memory_type: 'kpi_definition',
    content: 'Total Asset Utilization (TAU) = (Total Gross Profit Generated) / (Total Depreciated Asset Value + Cost of Capital). This is more strategic than OEE. Example: A press may have 85% OEE but low TAU if running simple jobs on expensive equipment. Guides capital investment decisions.',
    metadata: { topic: 'asset-utilization', kpi_name: 'total_asset_utilization', source: 'agog-kpi-tier2', priority: 'high' }
  },

  // Event-Driven Architecture
  {
    memory_type: 'architectural_decision',
    content: 'AGOG is event-driven, not batch. Quote from vendor: "You are building a central nervous system for the business that senses, calculates, and acts." Every significant action fires an event (e.g., material.roll.nearing_end → auto-notify forklift driver). Events drive real-time KPI updates and autonomous operations.',
    metadata: { topic: 'event-driven', source: 'agog-kpi-vendor', priority: 'critical' }
  },

  // OLAP→OLTP→API→UX Pattern
  {
    memory_type: 'architectural_decision',
    content: 'Schema-driven development pattern: Start with OLAP (define KPIs and data warehouse), then OLTP (operational database to capture data for KPIs), then API (GraphQL/REST), then UX (React components). This ensures every feature ties back to business value. Always ask: "What KPI does this support?"',
    metadata: { topic: 'schema-driven-development', source: 'agog-progress-metrics', priority: 'critical' }
  },

  // Multi-Tenant with SCD Type 2
  {
    memory_type: 'architectural_decision',
    content: 'Tenant table uses SCD Type 2 (Slowly Changing Dimensions) for historical tracking. Columns: effective_start_date, effective_end_date, is_current (boolean), version (integer). This tracks tier upgrades, billing changes, config changes without losing history. Every table (except system tables) has tenant_id with RLS policies.',
    metadata: { topic: 'multi-tenant', source: 'agog-saas-conversation', priority: 'critical' }
  },

  // Billing Entity Separation
  {
    memory_type: 'architectural_decision',
    content: 'Tenant → Billing Entity (many-to-one relationship). One customer may have multiple tenants (subsidiaries, brands) but one billing entity. Example: Acme Corp billing entity has Acme Packaging tenant, Acme Labels tenant, Acme Flexible tenant. One invoice to Acme Corp for all three.',
    metadata: { topic: 'billing', source: 'agog-saas-conversation', priority: 'high' }
  },

  // Multi-Currency Requirements
  {
    memory_type: 'implementation',
    content: 'Multi-currency requirements: 1 to many currencies per tenant, 1 and only 1 default currency per tenant. Each vendor/customer has exactly 1 currency. CRITICAL: Store exchange rate AT TIME OF TRANSACTION. Never recalculate historical transactions with new rates (breaks financial accuracy).',
    metadata: { topic: 'multi-currency', source: 'agog-saas-conversation', priority: 'high' }
  },

  // Lot Genealogy (Regulatory Compliance)
  {
    memory_type: 'implementation',
    content: 'Lot genealogy is MANDATORY for food packaging (FDA/FSMA compliance). Four relationship types: Split (1 parent → many children), Combine (many parents → 1 child), Rework (defective → reprocessed), Repackage (same material, different packaging). Must support forward tracing (lot → customers) and backward tracing (product → source lots).',
    metadata: { topic: 'lot-tracking', source: 'agog-wms-requirements', priority: 'critical' }
  },

  // Unassembled Kit Management
  {
    memory_type: 'implementation',
    content: 'Unassembled kit management: Kits with optional components create multiple kit versions. is_required_for_inventory flag: true = shortage blocks kit (default), false = shortage creates alternate version. Example: Box (required) + Brochure (optional). If 4 boxes, 3 brochures → Version 1 (with brochure): 3 units, Version 2 (without): 1 unit, Total: 4 units available.',
    metadata: { topic: 'kits', source: 'agog-wms-requirements', priority: 'high' }
  },

  // OEE Loss Costing (Finance Integration)
  {
    memory_type: 'kpi_definition',
    content: 'OEE Loss Costing translates Availability, Performance, Quality losses into dollar value. Example: Machine down 2 hours (Availability) = 2 × $500/hr = $1000 lost. Running at 80% speed (Performance) = 0.20 × $500/hr × 8 hours = $800 lost. 5% scrap (Quality) = 5% × $10000 material = $500 lost. Total: $2300/shift lost. This is CFO-level intelligence for operational managers.',
    metadata: { topic: 'oee-loss-costing', kpi_name: 'oee_loss_cost', source: 'agog-kpi-tier2', priority: 'high' }
  },

  // Autonomous Procurement
  {
    memory_type: 'implementation',
    content: 'Tier 3 KPI: Autonomous Procurement Trigger. System doesn\'t just report low inventory - it CREATES and PLACES POs automatically. Flow: material.consumption event → update digital twin inventory → predict stock-out date → check contract terms → create PO → for commoditized items, execute PO via supplier API. KPI: % of Purchase Orders Auto-Generated.',
    metadata: { topic: 'autonomous-procurement', source: 'agog-kpi-tier2', priority: 'medium' }
  },

  // Predictive Margin per Machine Hour
  {
    memory_type: 'implementation',
    content: 'Predictive Margin per Machine Hour: Before scheduling, system evaluates ALL suitable machines for each job. Calculates: (Quoted Price - Material - Changeover Time × Rate - Makeready Waste × Material Cost) / Run Time. Schedules job on machine with HIGHEST margin per hour, not just fastest machine. Optimizes profitability, not just speed.',
    metadata: { topic: 'scheduling-optimization', source: 'agog-kpi-tier2', priority: 'high' }
  },

  // Wave Processing
  {
    memory_type: 'implementation',
    content: 'Wave Processing groups multiple jobs for efficient material allocation and picking. Types: Discrete (one order, rush), Batch (multiple orders, similar), Cluster (multiple orders, mixed SKUs), Zone (by warehouse zones). Lifecycle: Planned → Released → Picking → Picked → Staged → Completed. Optimization: priority sequencing, route optimization (minimize travel), capacity planning.',
    metadata: { topic: 'wave-processing', source: 'agog-wms-requirements', priority: 'medium' }
  },

  // Color Quality Metrics
  {
    memory_type: 'kpi_definition',
    content: 'Print quality KPIs: First-Pass Print Approval Rate %, Color Density/Deviation (ΔE - continuous measurement, not pass/fail), Registration Accuracy (microns). Critical: Inline spectrophotometers and vision systems feed quality_measurements table via event streams for real-time monitoring. This is the brand differentiator for packaging.',
    metadata: { topic: 'print-quality', kpi_name: 'print_quality_metrics', source: 'agog-kpi-packaging', priority: 'high' }
  },

  // Changeover Efficiency
  {
    memory_type: 'kpi_definition',
    content: 'Changeover & Setup Efficiency KPIs: Average Changeover Time per work center, Changeover Time vs. Standard, OEE with focus on Availability Loss from Changeovers. Track in changeover_details table with Previous_Job_ID, Next_Job_ID, Reason_Code_For_Delay. This is the flexibility enabler - ability to run short batches profitably.',
    metadata: { topic: 'changeover', kpi_name: 'changeover_efficiency', source: 'agog-kpi-packaging', priority: 'high' }
  },

  // Unified Cost-of-Delivery Model
  {
    memory_type: 'kpi_definition',
    content: 'Unified Cost-of-Delivery Model uses Activity-Based Costing, automatically allocated by events. Includes: Customer service time (from CRM), Special handling costs (custom pallets), Payment delay cost (60-day terms = cost of capital). KPI: True Net Profit by Customer (after ALL overhead allocations). Separates profitable customers from unprofitable ones.',
    metadata: { topic: 'customer-profitability', kpi_name: 'true_net_profit_by_customer', source: 'agog-kpi-tier2', priority: 'high' }
  },

  // Machine-Specific Metrics
  {
    memory_type: 'kpi_definition',
    content: 'Machine-specific metrics for IoT monitoring: Corrugator (Liner Flute Bond Strength, Web Breaks/shift), Press Digital/Flexo (Ink Consumption/Job, Plate Usage/Clicks), Die-Cutter (Die Wear, Cuts/Minute), Extruder film (Melt Flow Index, Gauge Variation). These are equipment-specific KPIs critical for packaging manufacturing.',
    metadata: { topic: 'iot-metrics', source: 'agog-kpi-packaging', priority: 'medium' }
  },

  // Predictive Business Risk Index
  {
    memory_type: 'kpi_definition',
    content: 'Predictive Business Risk Index: Composite score 0-100 updated real-time. Inputs: Supply chain risk (single-source materials count), Machine failure risk (predictive maintenance models), Customer concentration risk (% profit from top 3), Labor risk (overtime hours, absenteeism), Credit risk (days payable outstanding). Gives C-suite/PE board single dashboard light for business health.',
    metadata: { topic: 'risk-management', kpi_name: 'business_risk_index', source: 'agog-kpi-tier2', priority: 'medium' }
  },

  // Competitive Differentiation
  {
    memory_type: 'architectural_decision',
    content: 'Competitive differentiation: (1) Industry-specific focus - tailored for print/packaging, not generic like SAP/Oracle. (2) Strategy optimization engine - AI recommendations for manufacturing strategy. (3) Integrated ecosystem - production + fulfillment in one platform. (4) Data-driven insights - predictive, not just historical. When building features, ask: "Does this differentiate us from SAP?"',
    metadata: { topic: 'competitive-advantage', source: 'agog-saas-conversation', priority: 'high' }
  },

  // Quality Standards from AGOG
  {
    memory_type: 'quality_standard',
    content: 'AGOG quality metrics: 98.6% KPI validation pass rate (70/71 KPIs valid), 100% documentation coverage, 100% standards compliance (git commits, pre-commit hooks). Todd expects HIGH quality. 98.6% was acceptable. 100% is the goal. All schemas must validate before implementation.',
    metadata: { topic: 'quality-standards', source: 'agog-progress-metrics', priority: 'high' }
  },

  // Technology Stack Rationale
  {
    memory_type: 'architectural_decision',
    content: 'Technology stack: PostgreSQL (RLS for multi-tenant), Node.js/TypeScript backend, React frontend, GraphQL Apollo Federation, NATS for events, Redis for caching, Docker/Kubernetes deployment, Blue-green deployment strategy. These decisions were made in AGOG. Don\'t second-guess them in AgogSaaS - build on this foundation.',
    metadata: { topic: 'technology-stack', source: 'agog-saas-conversation', priority: 'critical' }
  },

  // Naming Convention Enforcement
  {
    memory_type: 'quality_standard',
    content: 'Naming conventions are MANDATORY across ALL 13+ modules. Database tables: {module}_{entity_plural} (sales_orders, not orders). GraphQL types: {Module}{Entity} (SalesOrder, not Order). Every table must have tenant_id (except system tables), created_at, updated_at, created_by, updated_by. Use uuid_generate_v7() for time-ordered primary keys.',
    metadata: { topic: 'naming-conventions', source: 'agogsaas-standards', priority: 'critical' }
  },

  // Module Data Flow Patterns
  {
    memory_type: 'architectural_decision',
    content: 'Module data flow patterns: Sales/Scheduling flow DOWN (Global → Regional → Facility, demand/planning flows down). Capacity/Assets/Operations/Finance/Quality flow UP (Local → Regional → Global, data aggregates up). WMS/Procurement flow BOTH (master data down, transactions up). Always determine direction before building features.',
    metadata: { topic: 'data-flow-patterns', source: 'agogsaas-module-architecture', priority: 'critical' }
  }
];

async function importMemories() {
  console.log('🧠 Importing AGOG memories into Phase 4 memory system...\n');

  const client = new MCPMemoryClient();
  let successCount = 0;
  let errorCount = 0;

  for (const [index, memory] of memories.entries()) {
    try {
      const result = await client.storeMemory({
        agent_id: agentId,
        memory_type: memory.memory_type,
        content: memory.content,
        metadata: memory.metadata
      });

      console.log(`✅ [${index + 1}/${memories.length}] Stored: ${memory.metadata.topic}`);
      if (result && typeof result === 'string') {
        console.log(`   Memory ID: ${result.substring(0, 8)}...`);
      }
      successCount++;
    } catch (error: any) {
      console.error(`❌ [${index + 1}/${memories.length}] Failed: ${memory.metadata.topic}`);
      console.error(`   Error: ${error?.message || String(error)}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successCount}/${memories.length}`);
  console.log(`   ❌ Errors: ${errorCount}/${memories.length}`);

  if (successCount > 0) {
    console.log(`\n🔍 Test semantic search:`);
    console.log(`   Try: "How does AGOG handle multi-currency?"`);
    console.log(`   Try: "What is the most important KPI?"`);
    console.log(`   Try: "How should lot tracking work?"`);
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run import
importMemories().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
