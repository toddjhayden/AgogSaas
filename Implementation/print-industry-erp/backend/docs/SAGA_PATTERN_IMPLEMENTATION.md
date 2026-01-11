# Saga Pattern Implementation - Demand-to-Cash

**REQ-1767541724201-s8kck** - Implement End-to-End Demand-to-Cash Saga Pattern

## Overview

This implementation provides a robust, production-ready saga orchestration framework for managing long-running distributed transactions in the print industry ERP system. The saga pattern enables reliable execution of complex business processes that span multiple services and databases, with automatic compensation on failure.

## Architecture

### Core Components

1. **SagaOrchestratorService** - Core orchestration engine
   - Sequential step execution
   - Automatic compensation on failure
   - Retry logic with exponential backoff
   - Event logging and audit trail
   - Multi-tenant isolation

2. **DemandToCashSagaService** - Business-specific saga implementation
   - Quote creation
   - Inventory reservation
   - Production order creation (conditional)
   - Sales order conversion
   - Invoice generation
   - GL posting
   - Customer notifications

3. **Database Schema** - Persistent saga state
   - `saga_definitions` - Saga workflow templates
   - `saga_instances` - Running saga executions
   - `saga_step_executions` - Individual step records
   - `saga_event_log` - Complete audit trail

### Key Features

- **Automatic Compensation**: Failed steps trigger reverse-order compensation
- **Idempotency**: Steps can be safely retried without side effects
- **Observability**: Complete event log for debugging and compliance
- **Multi-Tenancy**: Full tenant isolation with RLS policies
- **Fault Tolerance**: Configurable retries with exponential backoff
- **SLA Tracking**: Deadline monitoring and timeout handling

## Database Schema

### Tables Created

```sql
-- V0.0.85__create_saga_orchestration_tables.sql
saga_definitions          -- Saga workflow definitions
saga_instances           -- Running saga instances
saga_step_executions     -- Individual step execution records
saga_event_log           -- Complete audit trail
```

### Key Indexes

- `idx_saga_instances_status` - Query by status
- `idx_saga_instances_deadline` - SLA monitoring
- `idx_saga_instances_entity` - Entity-based queries
- `idx_saga_event_log_instance` - Event lookups

## Saga Execution Flow

### 1. Saga Initialization

```typescript
const result = await demandToCashSaga.startDemandToCashSaga({
  tenantId: 'tenant-123',
  facilityId: 'facility-456',
  customerId: 'customer-789',
  quoteData: {
    items: [
      {
        productId: 'product-001',
        quantity: 1000,
        unitPrice: 0.50,
        description: 'Business Cards - 3.5x2 - 4/4 Color'
      }
    ],
    validUntil: new Date('2026-02-15'),
    notes: 'Rush order - 3 day turnaround'
  },
  userId: 'user-001'
});

// Returns: { sagaInstanceId, status, completedSteps, totalSteps }
```

### 2. Sequential Step Execution

Each step executes in order:

1. **Create Sales Quote** - Creates quote in CRM
2. **Reserve Inventory** - Reserves materials/stock
3. **Check Production** - Determines if make-to-order
4. **Create Production Order** - Schedules manufacturing (if needed)
5. **Convert to Sales Order** - Creates confirmed order
6. **Create Invoice** - Generates customer invoice
7. **Post to GL** - Records in general ledger
8. **Send Notification** - Emails invoice to customer

### 3. Compensation on Failure

If any step fails, compensation executes in reverse order:

```
Forward:  Step1 → Step2 → Step3 → [FAIL]
Compensate: ←Step3 ←Step2 ←Step1
```

Each step has a corresponding compensation action:

| Forward Action | Compensation Action |
|---------------|-------------------|
| `createQuote` | `voidQuote` |
| `reserveInventory` | `releaseInventory` |
| `createProductionOrder` | `cancelProductionOrder` |
| `convertQuoteToOrder` | `cancelSalesOrder` |
| `createInvoice` | `voidInvoice` |
| `postInvoiceToGL` | `reverseGLEntry` |

## GraphQL API

### Queries

```graphql
# Get saga instance details
query GetSagaInstance {
  sagaInstance(id: "instance-123") {
    id
    sagaName
    status
    currentStepIndex
    startedAt
    completedAt
    errorMessage
    steps {
      stepName
      status
      startedAt
      completedAt
      errorMessage
    }
    events {
      eventType
      eventData
      createdAt
    }
  }
}

# List saga instances
query ListSagaInstances {
  sagaInstances(
    tenantId: "tenant-123"
    status: RUNNING
    limit: 50
  ) {
    id
    sagaName
    status
    startedAt
  }
}
```

### Mutations

```graphql
# Start demand-to-cash saga
mutation StartDemandToCash {
  startDemandToCashSaga(input: {
    tenantId: "tenant-123"
    facilityId: "facility-456"
    customerId: "customer-789"
    quoteData: {
      items: [
        {
          productId: "product-001"
          quantity: 1000
          unitPrice: 0.50
          description: "Business Cards"
        }
      ]
      validUntil: "2026-02-15T00:00:00Z"
    }
  }) {
    sagaInstanceId
    status
    completedSteps
    totalSteps
  }
}

# Retry failed saga
mutation RetrySaga {
  retrySaga(sagaInstanceId: "instance-123") {
    sagaInstanceId
    status
  }
}

# Cancel running saga
mutation CancelSaga {
  cancelSaga(
    sagaInstanceId: "instance-123"
    reason: "Customer cancelled order"
  ) {
    sagaInstanceId
    status
  }
}
```

## Monitoring and Observability

### Saga Status Values

- `STARTED` - Initial state, queued for execution
- `RUNNING` - Currently executing steps
- `COMPENSATING` - Failure occurred, rolling back
- `COMPLETED` - Successfully finished all steps
- `FAILED` - Compensation also failed
- `COMPENSATED` - Successfully rolled back

### Step Status Values

- `PENDING` - Queued for execution
- `RUNNING` - Currently executing
- `COMPLETED` - Successfully finished
- `FAILED` - Execution failed
- `COMPENSATING` - Compensation in progress
- `COMPENSATED` - Successfully compensated
- `COMPENSATION_FAILED` - Compensation failed

### Event Types

The saga event log captures all significant events:

- `saga_started` - Saga instance created
- `saga_completed` - All steps successful
- `saga_failed` - Saga failed permanently
- `saga_compensated` - Rollback completed
- `saga_cancelled` - User-initiated cancellation
- `step_completed` - Step finished successfully
- `step_failed` - Step execution failed
- `step_compensated` - Compensation successful
- `compensation_failed` - Compensation failed

### Monitoring Queries

```sql
-- Active sagas by status
SELECT saga_name, status, COUNT(*)
FROM saga_instances
WHERE tenant_id = 'tenant-123'
GROUP BY saga_name, status;

-- Failed sagas requiring attention
SELECT id, saga_name, error_message, started_at
FROM saga_instances
WHERE tenant_id = 'tenant-123'
  AND status IN ('FAILED', 'COMPENSATION_FAILED')
ORDER BY started_at DESC;

-- Saga execution timeline
SELECT
  si.saga_name,
  si.status,
  si.started_at,
  si.completed_at,
  EXTRACT(EPOCH FROM (COALESCE(si.completed_at, NOW()) - si.started_at)) as duration_seconds
FROM saga_instances si
WHERE si.tenant_id = 'tenant-123'
ORDER BY si.started_at DESC
LIMIT 50;

-- Step failure analysis
SELECT
  step_name,
  COUNT(*) as failures,
  COUNT(DISTINCT saga_instance_id) as affected_sagas
FROM saga_step_executions
WHERE tenant_id = 'tenant-123'
  AND status = 'FAILED'
  AND failed_at > NOW() - INTERVAL '7 days'
GROUP BY step_name
ORDER BY failures DESC;
```

## Error Handling

### Retry Strategy

Steps can be configured as retryable with exponential backoff:

```typescript
{
  stepName: 'reserve_inventory',
  retryable: true,
  maxRetries: 3,
  // Retries at: 1s, 2s, 3s intervals
}
```

### Timeout Handling

Each step and saga can have timeout limits:

```typescript
{
  stepName: 'create_invoice',
  timeout: 30, // 30 seconds
}
```

### Compensation Failure

If compensation fails, the saga enters `FAILED` status and requires manual intervention:

1. Review error logs in `saga_event_log`
2. Identify failed compensation step
3. Manually fix underlying issue
4. Use `retrySaga` mutation to restart

## Testing

### Unit Tests

```bash
npm test src/modules/saga/__tests__/saga-orchestrator.service.spec.ts
```

### Integration Tests

Integration tests validate end-to-end saga execution:

1. Start saga with valid input
2. Verify sequential step execution
3. Simulate step failure
4. Verify compensation executes in reverse
5. Check final saga status

### Load Testing

For production validation, test saga execution under load:

```bash
# Run 100 concurrent sagas
k6 run k6/saga-load-test.js
```

## Production Considerations

### Performance

- **Async Execution**: Sagas execute asynchronously after creation
- **Database Load**: Each step creates 2-3 database records
- **Memory**: Saga context stored in JSONB, limit to < 1MB per saga
- **Timeout**: Default 2-hour saga timeout prevents hung instances

### Scalability

- **Horizontal Scaling**: Multiple orchestrator instances can run concurrently
- **Partition Key**: Tenant ID enables database partitioning
- **Event Log Archival**: Archive old events to maintain performance

### Security

- **Multi-Tenant Isolation**: RLS policies enforce tenant boundaries
- **Audit Trail**: Complete event log for compliance
- **Input Validation**: All inputs validated before saga creation
- **Authorization**: JWT authentication required for all operations

## Troubleshooting

### Common Issues

1. **Saga Stuck in RUNNING**
   - Check for hung steps in `saga_step_executions`
   - Review timeout configuration
   - Consider manual cancellation

2. **Compensation Failed**
   - Review `saga_event_log` for error details
   - Manually fix underlying data issue
   - Use `retrySaga` to restart

3. **High Failure Rate**
   - Analyze step failure patterns
   - Increase retry counts or timeouts
   - Check dependent service availability

### Debug Queries

```sql
-- Get complete saga execution details
SELECT
  si.*,
  json_agg(sse ORDER BY sse.step_index) as steps
FROM saga_instances si
LEFT JOIN saga_step_executions sse ON sse.saga_instance_id = si.id
WHERE si.id = 'instance-123'
GROUP BY si.id;

-- Get event timeline for saga
SELECT
  event_type,
  event_data,
  created_at
FROM saga_event_log
WHERE saga_instance_id = 'instance-123'
ORDER BY created_at;
```

## Future Enhancements

1. **Parallel Step Execution** - Execute independent steps concurrently
2. **Conditional Branching** - Skip steps based on saga context
3. **Sub-Sagas** - Nest sagas for complex workflows
4. **External Service Integration** - Call HTTP APIs as saga steps
5. **Agent Integration** - Trigger AI agents as saga steps
6. **Dashboard UI** - Real-time saga monitoring interface

## Related Documentation

- [Workflow Automation Engine](./WORKFLOW_AUTOMATION.md)
- [Finance Module Architecture](./FINANCE_MODULE.md)
- [Multi-Tenant Architecture](./MULTI_TENANT_RLS_ARCHITECTURE.md)
- [GraphQL Security](./GRAPHQL_SECURITY_IMPLEMENTATION.md)

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-11 | 1.0.0 | Initial saga pattern implementation |

---

**Implementation By**: Roy (Backend Agent)
**Requirement**: REQ-1767541724201-s8kck
**Database Migration**: V0.0.85__create_saga_orchestration_tables.sql
