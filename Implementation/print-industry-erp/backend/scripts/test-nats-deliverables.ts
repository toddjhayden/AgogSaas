#!/usr/bin/env ts-node
/**
 * Test NATS Deliverable System
 * Demonstrates the full agent workflow with NATS
 *
 * Usage:
 *   npm run test:nats
 *   OR
 *   ts-node scripts/test-nats-deliverables.ts
 */

import { NATSDeliverableService } from '../src/nats/nats-deliverable.service';
import dotenv from 'dotenv';

dotenv.config();

async function testNATSDeliverables() {
  console.log('🧪 Testing NATS Deliverable System');
  console.log('===================================\n');

  const natsService = new NATSDeliverableService();

  try {
    // Connect to NATS
    console.log('📡 Connecting to NATS...');
    await natsService.initialize();
    console.log('✅ Connected\n');

    // Feature name for testing
    const featureName = 'customer-search-test';

    // ============================================
    // STEP 1: Cynthia does research
    // ============================================
    console.log('👩‍🔬 STEP 1: Cynthia (Research Agent)');
    console.log('─────────────────────────────────────');

    const researchReport = `
# Research Report: Customer Search Feature

**Feature:** Customer Search
**Agent:** Cynthia
**Date:** 2025-12-17
**Complexity:** Medium

---

## Executive Summary

Researched customer search requirements for the print industry ERP system.
Analyzed existing patterns in codebase and identified optimal approach.

## Requirements Analysis

### Functional Requirements
1. Search by customer number
2. Search by customer name (partial match)
3. Search by email
4. Search by phone
5. Filter by tenant_id (multi-tenant isolation)

### Non-Functional Requirements
1. Response time: < 100ms
2. Support 10,000+ customers per tenant
3. Full-text search capabilities

## Technical Approach

### Database Schema
- Use existing customers table
- Add GIN index for full-text search
- Ensure tenant_id filtering in all queries

### GraphQL API
\`\`\`graphql
type Query {
  searchCustomers(
    query: String
    filters: CustomerFilters
  ): [Customer!]!
}
\`\`\`

## Implementation Recommendations

1. Use PostgreSQL pg_trgm extension for fuzzy search
2. Add composite index on (tenant_id, customer_number)
3. Implement cursor-based pagination
4. Add RLS policy for tenant isolation

## Next Steps

- [ ] Critique by Sylvia
- [ ] Backend implementation by Roy
- [ ] Frontend implementation by Jen
- [ ] QA by Billy

---

**Estimated Complexity:** Medium (3-5 hours)
**Blockers:** None
**Ready for Critique:** Yes
`;

    // Publish full report to NATS (5,000+ tokens)
    console.log('Publishing research report to NATS...');
    await natsService.publishReport({
      agent: 'cynthia',
      taskType: 'research',
      featureName: featureName,
      reportContent: researchReport,
      metadata: {
        files_analyzed: 15,
        duration_minutes: 12,
        references: ['customers.yaml', 'graphql-standards.md'],
      },
    });

    // Return tiny completion notice (~200 tokens)
    const cynthiaNotice = natsService.createCompletionNotice(
      'cynthia',
      featureName,
      natsService.buildChannelName('cynthia', 'research', featureName),
      'Researched customer search patterns and requirements',
      {
        complexity: 'Medium',
        ready_for_next_stage: true,
      }
    );

    console.log('✅ Research complete');
    console.log('Completion Notice:', JSON.stringify(cynthiaNotice, null, 2));
    console.log('');

    // ============================================
    // STEP 2: Sylvia fetches and critiques
    // ============================================
    console.log('👩‍⚖️ STEP 2: Sylvia (Critique Agent)');
    console.log('────────────────────────────────────');

    // Fetch Cynthia's full report from NATS
    console.log('Fetching Cynthia\'s research from NATS...');
    const cynthiaReport = await natsService.fetchReport({
      agent: 'cynthia',
      taskType: 'research',
      featureName: featureName,
    });

    if (!cynthiaReport) {
      throw new Error('Failed to fetch Cynthia\'s report');
    }

    console.log(`✅ Fetched report (${cynthiaReport.content.length} chars)`);
    console.log(`   Published at: ${cynthiaReport.timestamp}`);
    console.log('');

    // Perform critique (simulated)
    const critiqueReport = `
# Critique Report: Customer Search Feature

**Feature:** Customer Search
**Agent:** Sylvia
**Date:** 2025-12-17
**Status:** APPROVED

---

## Research Quality Assessment

✅ **Requirements:** Comprehensive and well-structured
✅ **Technical Approach:** Sound, follows AGOG standards
✅ **Database Design:** Proper tenant_id filtering included
✅ **API Design:** GraphQL schema follows conventions
✅ **Performance:** Realistic estimates

## Recommended Improvements

1. Add rate limiting considerations
2. Consider caching for frequent searches
3. Document expected query patterns

## Security Review

✅ Tenant isolation properly planned
✅ RLS policy mentioned
✅ Input validation considered

## Decision

**APPROVED for implementation**

Ready for:
- Backend implementation (Roy)
- Frontend implementation (Jen)

---

**Critique Duration:** 5 minutes
**Issues Found:** 0 critical, 3 suggestions
`;

    // Publish critique to NATS
    console.log('Publishing critique report to NATS...');
    await natsService.publishReport({
      agent: 'sylvia',
      taskType: 'critique',
      featureName: featureName,
      reportContent: critiqueReport,
    });

    const sylviaNotice = natsService.createCompletionNotice(
      'sylvia',
      featureName,
      natsService.buildChannelName('sylvia', 'critique', featureName),
      'Critiqued research and approved for implementation',
      {
        complexity: 'Simple',
        ready_for_next_stage: true,
      }
    );

    console.log('✅ Critique complete');
    console.log('Completion Notice:', JSON.stringify(sylviaNotice, null, 2));
    console.log('');

    // ============================================
    // STEP 3: Roy fetches both reports for backend
    // ============================================
    console.log('👨‍💻 STEP 3: Roy (Backend Agent)');
    console.log('────────────────────────────────');

    // Fetch both previous reports
    console.log('Fetching previous reports from NATS...');

    const research = await natsService.fetchReport({
      agent: 'cynthia',
      taskType: 'research',
      featureName: featureName,
    });

    const critique = await natsService.fetchReport({
      agent: 'sylvia',
      taskType: 'critique',
      featureName: featureName,
    });

    console.log(`✅ Fetched research report (${research?.content.length} chars)`);
    console.log(`✅ Fetched critique report (${critique?.content.length} chars)`);
    console.log('');

    // Simulate backend implementation
    const backendReport = `
# Backend Implementation Report: Customer Search Feature

**Feature:** Customer Search
**Agent:** Roy
**Date:** 2025-12-17

---

## Implementation Summary

Implemented GraphQL API for customer search based on Cynthia's research
and Sylvia's approved recommendations.

## Files Created/Modified

1. \`src/modules/customers/schema/customer.graphql\`
2. \`src/modules/customers/resolvers/search.resolver.ts\`
3. \`src/modules/customers/services/customer-search.service.ts\`
4. \`migrations/V1.0.5__add_customer_search_indexes.sql\`
5. \`tests/customers/search.test.ts\`

## Database Changes

- Added GIN index for full-text search
- Added composite index (tenant_id, customer_number)
- Added RLS policy for tenant isolation

## GraphQL API

\`\`\`graphql
type Query {
  searchCustomers(
    query: String!
    filters: CustomerSearchFilters
    limit: Int = 20
  ): CustomerSearchResult!
}
\`\`\`

## Testing

- Unit tests: 12 passing
- Integration tests: 5 passing
- Performance: < 50ms average

## Ready for Frontend

Yes, API is documented and ready for Jen.

---

**Files Modified:** 5
**Tests Added:** 17
**Implementation Time:** 2 hours
`;

    console.log('Publishing backend implementation report to NATS...');
    await natsService.publishReport({
      agent: 'roy',
      taskType: 'backend',
      featureName: featureName,
      reportContent: backendReport,
      metadata: {
        files_modified: 5,
        tests_added: 17,
      },
    });

    const royNotice = natsService.createCompletionNotice(
      'roy',
      featureName,
      natsService.buildChannelName('roy', 'backend', featureName),
      'Implemented GraphQL API with customer search filters',
      {
        complexity: 'Medium',
        files_modified: 5,
        ready_for_next_stage: true,
      }
    );

    console.log('✅ Backend implementation complete');
    console.log('Completion Notice:', JSON.stringify(royNotice, null, 2));
    console.log('');

    // ============================================
    // MONITORING: Check stream status
    // ============================================
    console.log('📊 Stream Status');
    console.log('────────────────');

    const streamStatuses = await natsService.getStreamStatuses();

    for (const stream of streamStatuses) {
      if (stream.messages > 0) {
        console.log(`${stream.name}:`);
        console.log(`  Messages: ${stream.messages}`);
        console.log(`  Bytes: ${(stream.bytes / 1024).toFixed(2)} KB`);
        console.log('');
      }
    }

    // ============================================
    // TOKEN SAVINGS CALCULATION
    // ============================================
    console.log('💰 Token Savings Analysis');
    console.log('─────────────────────────');

    const fullReportTokens = Math.floor(
      (researchReport.length + critiqueReport.length) / 4
    ); // Rough estimate: 4 chars = 1 token

    const completionNoticeTokens = Math.floor(
      JSON.stringify(cynthiaNotice).length / 4 +
      JSON.stringify(sylviaNotice).length / 4
    );

    console.log('Without NATS (traditional approach):');
    console.log(`  Spawn Roy with full context: ~${fullReportTokens} tokens`);
    console.log('');
    console.log('With NATS (deliverable pattern):');
    console.log(`  Spawn Roy with tiny notices: ~${completionNoticeTokens} tokens`);
    console.log('');
    console.log(`Token Savings: ${fullReportTokens - completionNoticeTokens} tokens (${Math.round((1 - completionNoticeTokens / fullReportTokens) * 100)}%)`);
    console.log('');

    // Close connection
    await natsService.close();
    console.log('✅ Test complete!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    await natsService.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testNATSDeliverables();
}

export { testNATSDeliverables };
