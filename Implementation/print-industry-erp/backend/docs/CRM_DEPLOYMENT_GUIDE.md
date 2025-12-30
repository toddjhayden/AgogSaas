# CRM & Sales Pipeline Management - Deployment Guide

**REQ:** REQ-STRATEGIC-AUTO-1767116143665
**Feature:** Integrated CRM & Sales Pipeline Management
**Author:** Roy (Backend Architect)
**Date:** 2025-12-30

---

## Overview

This deployment implements a comprehensive CRM and sales pipeline management system with:

- **Contact Management** - Track leads and customer contacts with GDPR compliance
- **Opportunity Tracking** - Manage sales opportunities through customizable pipeline stages
- **Activity Logging** - Record calls, emails, meetings, demos, and other interactions
- **Collaboration** - Share notes and collaborate on deals
- **Analytics** - Pipeline metrics, win/loss analysis, and sales rep performance

---

## Architecture

### Database Tables

1. **crm_contacts** - Individual contact records with engagement tracking
2. **crm_pipeline_stages** - Configurable sales pipeline stages with probability weighting
3. **crm_opportunities** - Sales opportunities with BANT qualification
4. **crm_activities** - Activity log (calls, emails, meetings, demos)
5. **crm_notes** - Notes attached to opportunities, contacts, and customers
6. **crm_opportunity_stage_history** - Audit trail of pipeline stage changes

### Key Features

- **Multi-tenant isolation** with Row-Level Security (RLS) policies
- **GDPR compliance** with marketing consent tracking and email opt-out
- **BANT qualification** tracking (Budget, Authority, Need, Timeline)
- **Weighted pipeline values** for accurate forecasting
- **Stage velocity tracking** to identify bottlenecks
- **Win/loss analysis** with detailed loss reason tracking

---

## Deployment Steps

### 1. Run Database Migrations

```bash
cd print-industry-erp/backend
npm run migrate
```

This will apply:
- `V0.0.63__create_crm_sales_pipeline_tables.sql` - Create all CRM tables and views
- `V0.0.64__add_rls_crm_tables.sql` - Apply RLS policies

### 2. Verify Deployment

```bash
npm run verify:crm
```

Or manually:

```bash
ts-node scripts/verify-crm-deployment.ts
```

This verifies:
- All tables are created correctly
- RLS policies are in place
- Views are accessible
- Indexes are created

### 3. Initialize Default Pipeline Stages

For each new tenant, initialize default pipeline stages using GraphQL:

```graphql
mutation {
  initializeDefaultPipelineStages
}
```

This creates the standard pipeline stages:
1. Lead (10% probability)
2. Qualified (20% probability)
3. Needs Analysis (30% probability)
4. Proposal (50% probability)
5. Negotiation (70% probability)
6. Closed Won (100% probability)
7. Closed Lost (0% probability)

### 4. Start the Application

```bash
npm run start:dev
```

The CRM module is automatically loaded via `AppModule`.

---

## GraphQL API

### Contact Operations

```graphql
# Create a contact
mutation {
  createContact(input: {
    firstName: "John"
    lastName: "Smith"
    emailPrimary: "john.smith@example.com"
    jobTitle: "Purchasing Manager"
    customerId: "uuid-here"
    ownerUserId: "sales-rep-uuid"
  }) {
    id
    firstName
    lastName
    emailPrimary
  }
}

# Search contacts
query {
  searchContacts(searchTerm: "smith") {
    id
    firstName
    lastName
    emailPrimary
    jobTitle
  }
}

# Get contacts requiring follow-up
query {
  getContactsRequiringFollowUp(ownerUserId: "sales-rep-uuid") {
    id
    firstName
    lastName
    nextFollowUpDate
    lastContactType
  }
}
```

### Opportunity Operations

```graphql
# Create an opportunity
mutation {
  createOpportunity(input: {
    opportunityName: "Print Project - Annual Reports"
    customerId: "customer-uuid"
    primaryContactId: "contact-uuid"
    pipelineStageId: "stage-uuid"
    estimatedValue: 25000
    expectedCloseDate: "2025-02-15"
    ownerUserId: "sales-rep-uuid"
  }) {
    id
    opportunityNumber
    opportunityName
    estimatedValue
    weightedValue
  }
}

# Get pipeline summary
query {
  getPipelineSummary(ownerUserId: "sales-rep-uuid") {
    stageName
    opportunityCount
    totalValue
    totalWeightedValue
    avgProbability
  }
}

# Move opportunity to next stage
mutation {
  updateOpportunity(input: {
    id: "opp-uuid"
    pipelineStageId: "next-stage-uuid"
  }) {
    id
    pipelineStageId
    stageEnteredAt
  }
}

# Mark as closed won
mutation {
  updateOpportunity(input: {
    id: "opp-uuid"
    status: "WON"
    pipelineStageId: "closed-won-stage-uuid"
  }) {
    id
    status
    actualCloseDate
  }
}
```

### Activity Logging

```graphql
# Log a call
mutation {
  createActivity(input: {
    activityType: "CALL"
    activitySubject: "Discovery Call"
    activityDescription: "Discussed printing needs for Q1"
    opportunityId: "opp-uuid"
    contactId: "contact-uuid"
    durationMinutes: 30
    ownerUserId: "sales-rep-uuid"
  }) {
    id
    activityType
    activitySubject
    activityDate
  }
}

# Get activity timeline for opportunity
query {
  getActivitiesByOpportunity(opportunityId: "opp-uuid") {
    id
    activityType
    activitySubject
    activityDate
    ownerUserId
    isCompleted
  }
}

# Mark activity as completed
mutation {
  markActivityCompleted(
    id: "activity-uuid"
    outcome: "COMPLETED"
    nextSteps: "Send proposal by Friday"
  ) {
    id
    isCompleted
    outcome
    nextSteps
  }
}
```

### Notes and Collaboration

```graphql
# Add a note to an opportunity
mutation {
  createNote(input: {
    opportunityId: "opp-uuid"
    noteContent: "Customer is price-sensitive. Need to emphasize quality."
    noteType: "IMPORTANT"
    isPinned: true
  }) {
    id
    noteContent
    isPinned
  }
}

# Get notes for opportunity
query {
  getNotesByOpportunity(opportunityId: "opp-uuid") {
    id
    noteContent
    noteType
    isPinned
    createdBy
    createdAt
  }
}
```

---

## Analytics and Reporting

### Pipeline Summary View

```sql
SELECT * FROM crm_pipeline_summary
WHERE tenant_id = 'your-tenant-uuid'
ORDER BY sequence_number;
```

Returns:
- Opportunities count per stage
- Total value per stage
- Total weighted value per stage
- Average probability per stage

### Opportunities Requiring Action

```sql
SELECT * FROM crm_opportunities_requiring_action
WHERE tenant_id = 'your-tenant-uuid'
  AND owner_user_id = 'sales-rep-uuid'
ORDER BY next_action_date;
```

Shows opportunities with:
- Overdue actions
- Actions due soon (within 3 days)
- Scheduled actions

### Sales Rep Performance

```sql
SELECT * FROM crm_sales_rep_performance
WHERE tenant_id = 'your-tenant-uuid'
ORDER BY qtd_revenue DESC;
```

Metrics include:
- Open opportunities count
- Pipeline value
- Weighted pipeline value
- QTD wins and revenue
- YTD wins and revenue
- Win rate percentage

---

## Multi-Tenant Considerations

All CRM tables enforce tenant isolation through:

1. **RLS Policies** - Automatically filter by `app.current_tenant_id` session variable
2. **Tenant ID Column** - Every table has a `tenant_id` foreign key
3. **Application Context** - GraphQL context sets tenant context from authenticated user

---

## Security Features

### GDPR Compliance

- Marketing consent tracking with date and source
- Email opt-out flag
- "Do not contact" flag
- Privacy controls on notes (private notes only visible to creator)

### Data Privacy

- RLS ensures users only see data for their tenant
- Private notes are only visible to the creator
- Soft deletes preserve audit trail

---

## Performance Optimization

### Indexes

All tables have appropriate indexes on:
- `tenant_id` (for RLS performance)
- Foreign keys
- Frequently filtered columns (status, dates, owner)
- Search fields (email, name)

### Views

Pre-computed views for common queries:
- `crm_pipeline_summary` - Aggregated pipeline metrics
- `crm_opportunities_requiring_action` - Action-oriented view
- `crm_sales_rep_performance` - Performance metrics

---

## Common Use Cases

### 1. Lead Capture and Qualification

1. Create contact from web form or trade show
2. Log initial call activity
3. Qualify lead (BANT)
4. Create opportunity and move to "Qualified" stage

### 2. Opportunity Management

1. Create opportunity in "Lead" stage
2. Schedule discovery call (activity)
3. Qualify and move to "Needs Analysis"
4. Submit proposal and move to "Proposal"
5. Negotiate and move to "Negotiation"
6. Close as Won/Lost

### 3. Team Collaboration

1. Assign opportunity to sales rep (owner)
2. Add team members array for collaboration
3. Log activities visible to team
4. Add notes (public for team, private for personal)

### 4. Pipeline Forecasting

1. View pipeline summary by stage
2. Calculate weighted pipeline value
3. Analyze stage velocity (days in stage)
4. Identify stalled opportunities

---

## Troubleshooting

### Issue: RLS Policies Not Working

**Solution:** Ensure `app.current_tenant_id` is set in GraphQL context:

```typescript
await client.query(`SET LOCAL app.current_tenant_id = $1`, [tenantId]);
```

### Issue: Duplicate Opportunity Numbers

**Solution:** The system auto-generates unique opportunity numbers in format:
`OPP-YYYY-NNNNN`

If duplicates occur, check sequence generation in `OpportunityService.generateOpportunityNumber()`.

### Issue: Missing Pipeline Stages

**Solution:** Initialize default stages for the tenant:

```graphql
mutation {
  initializeDefaultPipelineStages
}
```

---

## Next Steps

After deployment:

1. **Configure Pipeline Stages** - Customize stages for your sales process
2. **Import Contacts** - Bulk import existing contacts
3. **Train Sales Team** - Provide training on CRM usage
4. **Set Up Reports** - Create custom reports and dashboards
5. **Integrate Email** - Connect email tracking for engagement metrics

---

## Support

For issues or questions:
- Check verification script output: `npm run verify:crm`
- Review migration logs
- Contact DevOps team (Berry/Miki)
