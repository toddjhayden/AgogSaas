/**
 * K6 Database Write Throughput Test
 * Tests database write performance and transaction handling
 *
 * REQ: REQ-P0-1768148786448-3r439 - Database stress testing
 *
 * Purpose: Measure write throughput and transaction performance
 * Tests:
 * - Insert performance
 * - Update performance
 * - Transaction commit times
 * - Write lock contention
 * - Batch write performance
 */

import { sleep, check } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { executeMutation, dbWriteDuration, dbWritesTotal, testData } from '../../lib/helpers.js';
import config from '../../config/test.config.js';

// Write-specific metrics
const insertDuration = new Trend('insert_duration');
const updateDuration = new Trend('update_duration');
const transactionDuration = new Trend('transaction_duration');
const batchWriteDuration = new Trend('batch_write_duration');
const writeConflicts = new Counter('write_conflicts');
const writeLockWaitTime = new Trend('write_lock_wait_time');
const successfulWrites = new Counter('successful_writes');
const failedWrites = new Counter('failed_writes');
const writeConflictRate = new Rate('write_conflict_rate');

export const options = {
  scenarios: {
    // Scenario 1: Sustained write load
    sustained_writes: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 writes per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    // Scenario 2: Burst writes
    burst_writes: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      stages: [
        { duration: '30s', target: 100 }, // Ramp to 100 writes/sec
        { duration: '1m', target: 100 }, // Sustain
        { duration: '30s', target: 10 }, // Ramp down
      ],
      preAllocatedVUs: 30,
      maxVUs: 100,
      startTime: '3m',
    },
    // Scenario 3: Concurrent writes to same records (lock contention)
    lock_contention: {
      executor: 'constant-vus',
      vus: 20,
      duration: '1m',
      startTime: '6m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'], // Allow 2% failures for writes
    insert_duration: ['p(95)<800', 'p(99)<1500'], // Inserts should be reasonably fast
    update_duration: ['p(95)<600', 'p(99)<1200'], // Updates typically faster
    transaction_duration: ['p(95)<1000', 'p(99)<2000'], // Transaction commits
    batch_write_duration: ['p(95)<2000', 'p(99)<4000'], // Batch operations take longer
    write_conflict_rate: ['rate<0.05'], // Less than 5% conflicts
    write_lock_wait_time: ['p(95)<500'], // Lock wait should be minimal
  },
  tags: {
    test_type: 'database',
    test_focus: 'write_throughput',
  },
};

const GRAPHQL_URL = `${config.BASE_URL}${config.GRAPHQL_ENDPOINT}`;

const mutations = {
  // Single insert
  createJournalEntry: `
    mutation CreateJournalEntry($input: CreateJournalEntryInput!) {
      createJournalEntry(input: $input) {
        id
        journalEntryNumber
        status
      }
    }
  `,
  // Multiple inserts (batch-like)
  createJournalEntryWithLines: `
    mutation CreateComplexJournalEntry($input: CreateJournalEntryInput!) {
      createJournalEntry(input: $input) {
        id
        journalEntryNumber
        status
        lines {
          id
          lineNumber
          debitAmount
          creditAmount
        }
      }
    }
  `,
  // Update operation
  updateInvoice: `
    mutation UpdateInvoice($id: ID!, $input: UpdateInvoiceInput!) {
      updateInvoice(id: $id, input: $input) {
        id
        status
      }
    }
  `,
  // Status update (frequently contested)
  logEquipmentStatus: `
    mutation LogEquipmentStatus($input: LogEquipmentStatusInput!) {
      logEquipmentStatus(input: $input) {
        id
        status
        statusStartTime
      }
    }
  `,
  // Production order creation (complex write)
  createProductionOrder: `
    mutation CreateProductionOrder($input: CreateProductionOrderInput!) {
      createProductionOrder(input: $input) {
        id
        productionOrderNumber
        status
      }
    }
  `,
};

export default function () {
  const tenantId = config.MOCK_TENANT_ID;
  const writeType = Math.random();
  let startTime, duration, response;

  try {
    if (writeType < 0.3) {
      // 30% - Simple insert
      startTime = new Date();
      response = executeMutation(
        GRAPHQL_URL,
        mutations.createJournalEntry,
        {
          input: {
            entryType: 'STANDARD',
            entryDate: testData.currentDate(),
            postingDate: testData.currentDate(),
            description: `Write test entry ${Date.now()}`,
            lines: [
              { accountId: 'acc-1000', debitAmount: 100.0, creditAmount: 0.0 },
              { accountId: 'acc-2000', debitAmount: 0.0, creditAmount: 100.0 },
            ],
          },
        },
        { 'x-tenant-id': tenantId },
        { name: 'write_simple_insert' }
      );
      duration = new Date() - startTime;
      insertDuration.add(duration);

      if (check(response, { 'simple insert successful': (r) => r.status === 200 })) {
        successfulWrites.add(1);
      } else {
        failedWrites.add(1);
      }
    } else if (writeType < 0.5) {
      // 20% - Batch insert (multiple lines)
      const lineCount = Math.floor(Math.random() * 15) + 5; // 5-20 lines
      const lines = [];
      let totalDebit = 0;

      for (let i = 0; i < lineCount - 1; i++) {
        const amount = Math.random() * 500;
        totalDebit += amount;
        lines.push({
          accountId: `acc-${1000 + i}`,
          debitAmount: amount,
          creditAmount: 0.0,
        });
      }

      lines.push({
        accountId: 'acc-9999',
        debitAmount: 0.0,
        creditAmount: totalDebit,
      });

      startTime = new Date();
      response = executeMutation(
        GRAPHQL_URL,
        mutations.createJournalEntryWithLines,
        {
          input: {
            entryType: 'STANDARD',
            entryDate: testData.currentDate(),
            postingDate: testData.currentDate(),
            description: `Batch write test ${Date.now()}`,
            lines,
          },
        },
        { 'x-tenant-id': tenantId },
        { name: 'write_batch_insert' }
      );
      duration = new Date() - startTime;
      batchWriteDuration.add(duration);
      insertDuration.add(duration);

      if (check(response, { 'batch insert successful': (r) => r.status === 200 })) {
        successfulWrites.add(1);
      } else {
        failedWrites.add(1);
      }
    } else if (writeType < 0.7) {
      // 20% - Update operation
      startTime = new Date();
      response = executeMutation(
        GRAPHQL_URL,
        mutations.updateInvoice,
        {
          id: 'invoice-001',
          input: {
            status: 'SENT',
            notes: `Updated at ${Date.now()}`,
          },
        },
        { 'x-tenant-id': tenantId },
        { name: 'write_update' }
      );
      duration = new Date() - startTime;
      updateDuration.add(duration);
      transactionDuration.add(duration);

      if (check(response, { 'update successful': (r) => r.status === 200 })) {
        successfulWrites.add(1);
      } else {
        failedWrites.add(1);
        // Check if it's a write conflict
        if (response.body && response.body.includes('conflict')) {
          writeConflicts.add(1);
          writeConflictRate.add(1);
        }
      }
    } else if (writeType < 0.85) {
      // 15% - Status update (hot record - tests lock contention)
      startTime = new Date();
      const lockWaitStart = new Date();

      response = executeMutation(
        GRAPHQL_URL,
        mutations.logEquipmentStatus,
        {
          input: {
            workCenterId: 'wc-001', // Same work center - creates contention
            status: Math.random() > 0.5 ? 'IN_USE' : 'AVAILABLE',
            notes: `Status update ${Date.now()}`,
          },
        },
        { 'x-tenant-id': tenantId },
        { name: 'write_status_update' }
      );

      const lockWaitTime = new Date() - lockWaitStart;
      writeLockWaitTime.add(lockWaitTime);
      duration = new Date() - startTime;
      updateDuration.add(duration);

      if (check(response, { 'status update successful': (r) => r.status === 200 })) {
        successfulWrites.add(1);
      } else {
        failedWrites.add(1);
        if (response.body && response.body.includes('lock')) {
          writeConflicts.add(1);
          writeConflictRate.add(1);
        }
      }
    } else {
      // 15% - Complex write (production order)
      startTime = new Date();
      response = executeMutation(
        GRAPHQL_URL,
        mutations.createProductionOrder,
        {
          input: {
            facilityId: 'facility-001',
            productionOrderNumber: testData.productionOrderNumber(),
            productId: 'product-001',
            quantityOrdered: Math.floor(Math.random() * 1000) + 100,
            unitOfMeasure: 'PIECES',
            priority: Math.floor(Math.random() * 5) + 1,
            dueDate: testData.futureDate(),
          },
        },
        { 'x-tenant-id': tenantId },
        { name: 'write_complex_insert' }
      );
      duration = new Date() - startTime;
      insertDuration.add(duration);
      transactionDuration.add(duration);

      if (check(response, { 'production order created': (r) => r.status === 200 })) {
        successfulWrites.add(1);
      } else {
        failedWrites.add(1);
      }
    }

    dbWriteDuration.add(duration);
    dbWritesTotal.add(1);
  } catch (error) {
    failedWrites.add(1);
    console.error(`Write error: ${error.message}`);
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const summary = {
    test_type: 'Database Write Throughput Test',
    timestamp: new Date().toISOString(),
    metrics: {
      total_writes: data.metrics.db_writes_total?.values?.count || 0,
      successful_writes: data.metrics.successful_writes?.values?.count || 0,
      failed_writes: data.metrics.failed_writes?.values?.count || 0,
      write_conflicts: data.metrics.write_conflicts?.values?.count || 0,
      insert_p95: data.metrics.insert_duration?.values?.['p(95)'] || 0,
      insert_p99: data.metrics.insert_duration?.values?.['p(99)'] || 0,
      update_p95: data.metrics.update_duration?.values?.['p(95)'] || 0,
      batch_write_p95: data.metrics.batch_write_duration?.values?.['p(95)'] || 0,
      transaction_p95: data.metrics.transaction_duration?.values?.['p(95)'] || 0,
      lock_wait_p95: data.metrics.write_lock_wait_time?.values?.['p(95)'] || 0,
      conflict_rate: data.metrics.write_conflict_rate?.values?.rate || 0,
      writes_per_second:
        (data.metrics.db_writes_total?.values?.count || 0) /
        ((data.state?.testRunDurationMs || 1) / 1000),
    },
    analysis: {
      write_performance_good:
        (data.metrics.insert_duration?.values?.['p(95)'] || 0) < 800 &&
        (data.metrics.update_duration?.values?.['p(95)'] || 0) < 600,
      conflict_rate_acceptable: (data.metrics.write_conflict_rate?.values?.rate || 0) < 0.05,
      lock_contention_minimal: (data.metrics.write_lock_wait_time?.values?.['p(95)'] || 0) < 500,
      throughput_adequate:
        (data.metrics.db_writes_total?.values?.count || 0) /
          ((data.state?.testRunDurationMs || 1) / 1000) >
        20,
    },
    recommendations: [],
  };

  // Generate recommendations
  if (!summary.analysis.write_performance_good) {
    summary.recommendations.push('Write performance is slow - check for missing indexes or slow storage');
  }
  if (!summary.analysis.conflict_rate_acceptable) {
    summary.recommendations.push('High write conflict rate - consider optimistic locking or retry logic');
  }
  if (!summary.analysis.lock_contention_minimal) {
    summary.recommendations.push(
      'High lock wait times - review transaction isolation levels and query patterns'
    );
  }
  if (!summary.analysis.throughput_adequate) {
    summary.recommendations.push('Low write throughput - scale database resources or optimize writes');
  }

  console.log('\n=== WRITE THROUGHPUT TEST SUMMARY ===');
  console.log(`Total Writes: ${summary.metrics.total_writes}`);
  console.log(`Successful: ${summary.metrics.successful_writes}`);
  console.log(`Failed: ${summary.metrics.failed_writes}`);
  console.log(`Write Conflicts: ${summary.metrics.write_conflicts}`);
  console.log(`Writes/Second: ${summary.metrics.writes_per_second.toFixed(2)}`);
  console.log(`Insert P95: ${summary.metrics.insert_p95}ms`);
  console.log(`Update P95: ${summary.metrics.update_p95}ms`);
  console.log(`Lock Wait P95: ${summary.metrics.lock_wait_p95}ms`);
  console.log(`Conflict Rate: ${(summary.metrics.conflict_rate * 100).toFixed(2)}%`);
  console.log('\n=== ANALYSIS ===');
  console.log(`Write Performance Good: ${summary.analysis.write_performance_good ? '✓' : '✗'}`);
  console.log(`Conflict Rate Acceptable: ${summary.analysis.conflict_rate_acceptable ? '✓' : '✗'}`);
  console.log(`Lock Contention Minimal: ${summary.analysis.lock_contention_minimal ? '✓' : '✗'}`);
  console.log(`Throughput Adequate: ${summary.analysis.throughput_adequate ? '✓' : '✗'}`);

  if (summary.recommendations.length > 0) {
    console.log('\n=== RECOMMENDATIONS ===');
    summary.recommendations.forEach((rec, idx) => {
      console.log(`${idx + 1}. ${rec}`);
    });
  }

  return {
    stdout: JSON.stringify(summary, null, 2),
    'write-throughput-test-summary.json': JSON.stringify(summary),
  };
}
