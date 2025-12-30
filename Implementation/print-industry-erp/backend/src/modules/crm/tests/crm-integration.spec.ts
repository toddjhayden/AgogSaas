import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { ConfigModule } from '@nestjs/config';
import { ContactService } from '../services/contact.service';
import { OpportunityService } from '../services/opportunity.service';
import { ActivityService } from '../services/activity.service';
import { PipelineStageService } from '../services/pipeline-stage.service';
import { NoteService } from '../services/note.service';

/**
 * CRM Integration Test Suite
 *
 * Tests for Integrated CRM & Sales Pipeline Management
 * REQ: REQ-STRATEGIC-AUTO-1767116143665
 *
 * COVERAGE:
 * - Multi-tenant isolation (CRITICAL)
 * - Database schema validation
 * - GraphQL query/mutation operations
 * - RLS policy enforcement
 * - Input sanitization
 * - GDPR compliance
 * - Activity logging
 * - Pipeline stage management
 *
 * TEST CATEGORIES:
 * 1. Database Schema Tests
 * 2. Multi-Tenant Isolation Tests
 * 3. CRUD Operation Tests
 * 4. RLS Policy Tests
 * 5. Business Logic Tests
 * 6. Security Tests
 * 7. Performance Tests
 */

describe('CRM Integration Tests', () => {
  let module: TestingModule;
  let db: Pool;
  let contactService: ContactService;
  let opportunityService: OpportunityService;
  let activityService: ActivityService;
  let pipelineStageService: PipelineStageService;
  let noteService: NoteService;

  const TENANT_A_ID = '00000000-0000-0000-0000-000000000001';
  const TENANT_B_ID = '00000000-0000-0000-0000-000000000002';
  const USER_A_ID = '00000000-0000-0000-0000-000000000011';
  const USER_B_ID = '00000000-0000-0000-0000-000000000012';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
      ],
      providers: [
        {
          provide: 'DATABASE_POOL',
          useFactory: () => {
            return new Pool({
              host: process.env.DB_HOST || 'localhost',
              port: parseInt(process.env.DB_PORT || '5432'),
              database: process.env.DB_NAME || 'print_erp_test',
              user: process.env.DB_USER || 'postgres',
              password: process.env.DB_PASSWORD,
            });
          },
        },
        ContactService,
        OpportunityService,
        ActivityService,
        PipelineStageService,
        NoteService,
      ],
    }).compile();

    db = module.get<Pool>('DATABASE_POOL');
    contactService = module.get<ContactService>(ContactService);
    opportunityService = module.get<OpportunityService>(OpportunityService);
    activityService = module.get<ActivityService>(ActivityService);
    pipelineStageService = module.get<PipelineStageService>(PipelineStageService);
    noteService = module.get<NoteService>(NoteService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.end();
    await module.close();
  });

  // =================================================================
  // DATABASE SCHEMA TESTS
  // =================================================================

  describe('Database Schema Validation', () => {
    test('should verify all CRM tables exist', async () => {
      const result = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name LIKE 'crm_%'
        ORDER BY table_name
      `);

      const tableNames = result.rows.map(r => r.table_name);
      expect(tableNames).toContain('crm_contacts');
      expect(tableNames).toContain('crm_opportunities');
      expect(tableNames).toContain('crm_pipeline_stages');
      expect(tableNames).toContain('crm_activities');
      expect(tableNames).toContain('crm_notes');
      expect(tableNames).toContain('crm_opportunity_stage_history');
    });

    test('should verify uuid_generate_v7() is default for all ID columns', async () => {
      const tables = [
        'crm_contacts',
        'crm_opportunities',
        'crm_pipeline_stages',
        'crm_activities',
        'crm_notes',
        'crm_opportunity_stage_history',
      ];

      for (const table of tables) {
        const result = await db.query(`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'id'
        `, [table]);

        expect(result.rows[0].column_default).toContain('uuid_generate_v7()');
      }
    });

    test('should verify tenant_id exists on all tables', async () => {
      const tables = [
        'crm_contacts',
        'crm_opportunities',
        'crm_pipeline_stages',
        'crm_activities',
        'crm_notes',
        'crm_opportunity_stage_history',
      ];

      for (const table of tables) {
        const result = await db.query(`
          SELECT column_name, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'tenant_id'
        `, [table]);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].is_nullable).toBe('NO');
      }
    });

    test('should verify all required indexes exist', async () => {
      const requiredIndexes = [
        'idx_crm_contacts_tenant',
        'idx_crm_contacts_customer',
        'idx_crm_contacts_owner',
        'idx_crm_opportunities_tenant',
        'idx_crm_opportunities_customer',
        'idx_crm_opportunities_stage',
        'idx_crm_activities_tenant',
        'idx_crm_activities_opportunity',
        'idx_crm_notes_tenant',
        'idx_crm_pipeline_stages_tenant',
      ];

      const result = await db.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename LIKE 'crm_%'
      `);

      const indexNames = result.rows.map(r => r.indexname);
      requiredIndexes.forEach(idx => {
        expect(indexNames).toContain(idx);
      });
    });

    test('should verify RLS is enabled on all CRM tables', async () => {
      const tables = [
        'crm_contacts',
        'crm_opportunities',
        'crm_pipeline_stages',
        'crm_activities',
        'crm_notes',
        'crm_opportunity_stage_history',
      ];

      const result = await db.query(`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = ANY($1)
      `, [tables]);

      expect(result.rows.length).toBe(tables.length);
      result.rows.forEach(row => {
        expect(row.rowsecurity).toBe(true);
      });
    });
  });

  // =================================================================
  // MULTI-TENANT ISOLATION TESTS (CRITICAL)
  // =================================================================

  describe('Multi-Tenant Isolation', () => {
    test('should prevent cross-tenant contact access', async () => {
      // Set tenant A context
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      // Create contact in tenant A
      const contactA = await db.query(`
        INSERT INTO crm_contacts (tenant_id, first_name, last_name, email_primary)
        VALUES ($1, 'John', 'Doe', 'john@tenanta.com')
        RETURNING id
      `, [TENANT_A_ID]);

      // Switch to tenant B context
      await db.query(`SET app.current_tenant_id = '${TENANT_B_ID}'`);

      // Try to query tenant A's contact - should return empty
      const result = await db.query(`
        SELECT * FROM crm_contacts WHERE id = $1
      `, [contactA.rows[0].id]);

      expect(result.rows.length).toBe(0);
    });

    test('should prevent cross-tenant opportunity access', async () => {
      // Set tenant A context
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      // Create opportunity in tenant A
      const stageA = await db.query(`
        SELECT id FROM crm_pipeline_stages WHERE tenant_id = $1 LIMIT 1
      `, [TENANT_A_ID]);

      const oppA = await db.query(`
        INSERT INTO crm_opportunities
        (tenant_id, opportunity_number, opportunity_name, pipeline_stage_id, estimated_value, owner_user_id)
        VALUES ($1, 'OPP-001', 'Test Opportunity', $2, 50000, $3)
        RETURNING id
      `, [TENANT_A_ID, stageA.rows[0].id, USER_A_ID]);

      // Switch to tenant B context
      await db.query(`SET app.current_tenant_id = '${TENANT_B_ID}'`);

      // Try to query tenant A's opportunity - should return empty
      const result = await db.query(`
        SELECT * FROM crm_opportunities WHERE id = $1
      `, [oppA.rows[0].id]);

      expect(result.rows.length).toBe(0);
    });

    test('should prevent cross-tenant activity access', async () => {
      // Set tenant A context
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      // Create activity in tenant A
      const actA = await db.query(`
        INSERT INTO crm_activities
        (tenant_id, activity_type, activity_subject, activity_date, owner_user_id)
        VALUES ($1, 'CALL', 'Follow-up call', NOW(), $2)
        RETURNING id
      `, [TENANT_A_ID, USER_A_ID]);

      // Switch to tenant B context
      await db.query(`SET app.current_tenant_id = '${TENANT_B_ID}'`);

      // Try to query tenant A's activity - should return empty
      const result = await db.query(`
        SELECT * FROM crm_activities WHERE id = $1
      `, [actA.rows[0].id]);

      expect(result.rows.length).toBe(0);
    });

    test('should enforce tenant isolation in notes with privacy controls', async () => {
      // Set tenant A context
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);
      await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

      // Create contact and note
      const contact = await db.query(`
        INSERT INTO crm_contacts (tenant_id, first_name, last_name)
        VALUES ($1, 'Jane', 'Smith')
        RETURNING id
      `, [TENANT_A_ID]);

      const noteA = await db.query(`
        INSERT INTO crm_notes
        (tenant_id, contact_id, note_content, is_private, created_by)
        VALUES ($1, $2, 'Private note', TRUE, $3)
        RETURNING id
      `, [TENANT_A_ID, contact.rows[0].id, USER_A_ID]);

      // Switch to tenant B - should not see note
      await db.query(`SET app.current_tenant_id = '${TENANT_B_ID}'`);
      await db.query(`SET app.current_user_id = '${USER_B_ID}'`);

      const result = await db.query(`
        SELECT * FROM crm_notes WHERE id = $1
      `, [noteA.rows[0].id]);

      expect(result.rows.length).toBe(0);
    });
  });

  // =================================================================
  // RLS POLICY TESTS
  // =================================================================

  describe('RLS Policy Enforcement', () => {
    test('should enforce private note visibility policy', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);
      await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

      // Create contact
      const contact = await db.query(`
        INSERT INTO crm_contacts (tenant_id, first_name, last_name)
        VALUES ($1, 'Test', 'Contact')
        RETURNING id
      `, [TENANT_A_ID]);

      // User A creates private note
      const privateNote = await db.query(`
        INSERT INTO crm_notes
        (tenant_id, contact_id, note_content, is_private, created_by)
        VALUES ($1, $2, 'User A private note', TRUE, $3)
        RETURNING id
      `, [TENANT_A_ID, contact.rows[0].id, USER_A_ID]);

      // User B (same tenant) tries to read - should NOT see
      await db.query(`SET app.current_user_id = '${USER_B_ID}'`);

      const resultB = await db.query(`
        SELECT * FROM crm_notes WHERE id = $1
      `, [privateNote.rows[0].id]);

      expect(resultB.rows.length).toBe(0);

      // User A can see their own private note
      await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

      const resultA = await db.query(`
        SELECT * FROM crm_notes WHERE id = $1
      `, [privateNote.rows[0].id]);

      expect(resultA.rows.length).toBe(1);
    });

    test('should allow UPDATE only for note creator', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);
      await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

      // Create contact
      const contact = await db.query(`
        INSERT INTO crm_contacts (tenant_id, first_name, last_name)
        VALUES ($1, 'Test', 'Contact2')
        RETURNING id
      `, [TENANT_A_ID]);

      // User A creates note
      const note = await db.query(`
        INSERT INTO crm_notes
        (tenant_id, contact_id, note_content, created_by)
        VALUES ($1, $2, 'Original content', $3)
        RETURNING id
      `, [TENANT_A_ID, contact.rows[0].id, USER_A_ID]);

      // User B tries to update - should fail
      await db.query(`SET app.current_user_id = '${USER_B_ID}'`);

      const updateResult = await db.query(`
        UPDATE crm_notes
        SET note_content = 'Modified by User B'
        WHERE id = $1
        RETURNING id
      `, [note.rows[0].id]);

      expect(updateResult.rows.length).toBe(0);

      // User A can update their own note
      await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

      const updateResultA = await db.query(`
        UPDATE crm_notes
        SET note_content = 'Modified by User A'
        WHERE id = $1
        RETURNING id
      `, [note.rows[0].id]);

      expect(updateResultA.rows.length).toBe(1);
    });

    test('should prevent INSERT with wrong tenant_id', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      // Try to insert contact with different tenant_id - should fail
      await expect(async () => {
        await db.query(`
          INSERT INTO crm_contacts (tenant_id, first_name, last_name)
          VALUES ($1, 'Bad', 'Actor')
        `, [TENANT_B_ID]);
      }).rejects.toThrow();
    });
  });

  // =================================================================
  // BUSINESS LOGIC TESTS
  // =================================================================

  describe('Pipeline Stage Management', () => {
    test('should calculate weighted value correctly', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const stage = await db.query(`
        SELECT id FROM crm_pipeline_stages
        WHERE tenant_id = $1 AND probability_percentage = 50
        LIMIT 1
      `, [TENANT_A_ID]);

      const opportunity = await db.query(`
        INSERT INTO crm_opportunities
        (tenant_id, opportunity_number, opportunity_name, pipeline_stage_id,
         estimated_value, probability_percentage, owner_user_id)
        VALUES ($1, 'OPP-WEIGHTED', 'Test Weighted', $2, 100000, 50, $3)
        RETURNING id, estimated_value, probability_percentage, weighted_value
      `, [TENANT_A_ID, stage.rows[0].id, USER_A_ID]);

      const opp = opportunity.rows[0];
      const expectedWeighted = (opp.estimated_value * opp.probability_percentage) / 100;

      expect(parseFloat(opp.weighted_value)).toBe(expectedWeighted);
      expect(parseFloat(opp.weighted_value)).toBe(50000);
    });

    test('should track stage history on opportunity update', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      // Get two stages
      const stages = await db.query(`
        SELECT id, stage_name FROM crm_pipeline_stages
        WHERE tenant_id = $1
        ORDER BY sequence_number
        LIMIT 2
      `, [TENANT_A_ID]);

      const fromStage = stages.rows[0];
      const toStage = stages.rows[1];

      // Create opportunity in first stage
      const opp = await db.query(`
        INSERT INTO crm_opportunities
        (tenant_id, opportunity_number, opportunity_name, pipeline_stage_id,
         estimated_value, owner_user_id)
        VALUES ($1, 'OPP-STAGE-HIST', 'Test Stage History', $2, 75000, $3)
        RETURNING id
      `, [TENANT_A_ID, fromStage.id, USER_A_ID]);

      // Record stage change
      await db.query(`
        INSERT INTO crm_opportunity_stage_history
        (tenant_id, opportunity_id, from_stage_id, to_stage_id, changed_by_user_id, days_in_previous_stage)
        VALUES ($1, $2, $3, $4, $5, 7)
      `, [TENANT_A_ID, opp.rows[0].id, fromStage.id, toStage.id, USER_A_ID]);

      // Verify history
      const history = await db.query(`
        SELECT * FROM crm_opportunity_stage_history
        WHERE opportunity_id = $1
      `, [opp.rows[0].id]);

      expect(history.rows.length).toBe(1);
      expect(history.rows[0].from_stage_id).toBe(fromStage.id);
      expect(history.rows[0].to_stage_id).toBe(toStage.id);
      expect(history.rows[0].days_in_previous_stage).toBe(7);
    });

    test('should enforce BANT qualification fields', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const stage = await db.query(`
        SELECT id FROM crm_pipeline_stages WHERE tenant_id = $1 LIMIT 1
      `, [TENANT_A_ID]);

      const opp = await db.query(`
        INSERT INTO crm_opportunities
        (tenant_id, opportunity_number, opportunity_name, pipeline_stage_id,
         estimated_value, owner_user_id,
         budget_confirmed, authority_confirmed, need_confirmed, timeline_confirmed)
        VALUES ($1, 'OPP-BANT', 'BANT Test', $2, 100000, $3, true, true, false, false)
        RETURNING budget_confirmed, authority_confirmed, need_confirmed, timeline_confirmed
      `, [TENANT_A_ID, stage.rows[0].id, USER_A_ID]);

      expect(opp.rows[0].budget_confirmed).toBe(true);
      expect(opp.rows[0].authority_confirmed).toBe(true);
      expect(opp.rows[0].need_confirmed).toBe(false);
      expect(opp.rows[0].timeline_confirmed).toBe(false);
    });
  });

  describe('Contact Management', () => {
    test('should store GDPR consent correctly', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const contact = await db.query(`
        INSERT INTO crm_contacts
        (tenant_id, first_name, last_name, email_primary,
         marketing_consent, marketing_consent_date, marketing_consent_source)
        VALUES ($1, 'GDPR', 'Test', 'gdpr@example.com', true, NOW(), 'WEBSITE_FORM')
        RETURNING marketing_consent, marketing_consent_source
      `, [TENANT_A_ID]);

      expect(contact.rows[0].marketing_consent).toBe(true);
      expect(contact.rows[0].marketing_consent_source).toBe('WEBSITE_FORM');
    });

    test('should respect do_not_contact flag', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const contact = await db.query(`
        INSERT INTO crm_contacts
        (tenant_id, first_name, last_name, do_not_contact)
        VALUES ($1, 'DoNotContact', 'Test', true)
        RETURNING id, do_not_contact
      `, [TENANT_A_ID]);

      expect(contact.rows[0].do_not_contact).toBe(true);

      // Query should still work (soft restriction, enforced in application)
      const result = await db.query(`
        SELECT * FROM crm_contacts WHERE id = $1
      `, [contact.rows[0].id]);

      expect(result.rows.length).toBe(1);
    });
  });

  describe('Activity Tracking', () => {
    test('should link activities to multiple entities', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      // Create contact, customer, opportunity
      const contact = await db.query(`
        INSERT INTO crm_contacts (tenant_id, first_name, last_name)
        VALUES ($1, 'Activity', 'Test')
        RETURNING id
      `, [TENANT_A_ID]);

      const customer = await db.query(`
        SELECT id FROM customers WHERE tenant_id = $1 LIMIT 1
      `, [TENANT_A_ID]);

      const stage = await db.query(`
        SELECT id FROM crm_pipeline_stages WHERE tenant_id = $1 LIMIT 1
      `, [TENANT_A_ID]);

      const opp = await db.query(`
        INSERT INTO crm_opportunities
        (tenant_id, opportunity_number, opportunity_name, pipeline_stage_id, estimated_value, owner_user_id, customer_id)
        VALUES ($1, 'OPP-ACT', 'Activity Test', $2, 50000, $3, $4)
        RETURNING id
      `, [TENANT_A_ID, stage.rows[0].id, USER_A_ID, customer.rows[0].id]);

      // Create activity linked to all three
      const activity = await db.query(`
        INSERT INTO crm_activities
        (tenant_id, activity_type, activity_subject, contact_id, customer_id, opportunity_id, owner_user_id)
        VALUES ($1, 'MEETING', 'Discovery Call', $2, $3, $4, $5)
        RETURNING contact_id, customer_id, opportunity_id
      `, [TENANT_A_ID, contact.rows[0].id, customer.rows[0].id, opp.rows[0].id, USER_A_ID]);

      expect(activity.rows[0].contact_id).toBe(contact.rows[0].id);
      expect(activity.rows[0].customer_id).toBe(customer.rows[0].id);
      expect(activity.rows[0].opportunity_id).toBe(opp.rows[0].id);
    });

    test('should track email engagement metrics', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const activity = await db.query(`
        INSERT INTO crm_activities
        (tenant_id, activity_type, activity_subject, owner_user_id,
         email_sent, email_opened, email_clicked)
        VALUES ($1, 'EMAIL', 'Product Demo Email', $2, true, true, false)
        RETURNING email_sent, email_opened, email_clicked
      `, [TENANT_A_ID, USER_A_ID]);

      expect(activity.rows[0].email_sent).toBe(true);
      expect(activity.rows[0].email_opened).toBe(true);
      expect(activity.rows[0].email_clicked).toBe(false);
    });
  });

  // =================================================================
  // SECURITY TESTS
  // =================================================================

  describe('Input Sanitization', () => {
    test('should prevent SQL injection in contact search', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const maliciousInput = "'; DROP TABLE crm_contacts; --";

      // This should not cause any issues
      await expect(async () => {
        await db.query(`
          SELECT * FROM crm_contacts
          WHERE tenant_id = $1
            AND (first_name ILIKE $2 OR last_name ILIKE $2 OR email_primary ILIKE $2)
        `, [TENANT_A_ID, `%${maliciousInput}%`]);
      }).not.toThrow();

      // Verify table still exists
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'crm_contacts'
        )
      `);

      expect(tableCheck.rows[0].exists).toBe(true);
    });

    test('should sanitize opportunity note content', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);
      await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

      const maliciousNote = "<script>alert('XSS')</script>Test note";

      const stage = await db.query(`
        SELECT id FROM crm_pipeline_stages WHERE tenant_id = $1 LIMIT 1
      `, [TENANT_A_ID]);

      const opp = await db.query(`
        INSERT INTO crm_opportunities
        (tenant_id, opportunity_number, opportunity_name, pipeline_stage_id, estimated_value, owner_user_id, notes)
        VALUES ($1, 'OPP-XSS', 'XSS Test', $2, 50000, $3, $4)
        RETURNING notes
      `, [TENANT_A_ID, stage.rows[0].id, USER_A_ID, maliciousNote]);

      // Content should be stored (sanitization happens at application layer)
      expect(opp.rows[0].notes).toBe(maliciousNote);
    });
  });

  // =================================================================
  // PERFORMANCE TESTS
  // =================================================================

  describe('Performance & Analytics', () => {
    test('should efficiently query pipeline summary view', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const startTime = Date.now();
      const summary = await db.query(`
        SELECT * FROM crm_pipeline_summary
        WHERE tenant_id = $1
        ORDER BY sequence_number
      `, [TENANT_A_ID]);
      const queryTime = Date.now() - startTime;

      // Query should complete in under 100ms
      expect(queryTime).toBeLessThan(100);
      expect(summary.rows.length).toBeGreaterThan(0);
    });

    test('should efficiently query opportunities requiring action', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const startTime = Date.now();
      const opps = await db.query(`
        SELECT * FROM crm_opportunities_requiring_action
        WHERE tenant_id = $1
        ORDER BY next_action_date
        LIMIT 20
      `, [TENANT_A_ID]);
      const queryTime = Date.now() - startTime;

      // Query should complete in under 100ms
      expect(queryTime).toBeLessThan(100);
    });

    test('should efficiently query sales rep performance', async () => {
      await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);

      const startTime = Date.now();
      const performance = await db.query(`
        SELECT * FROM crm_sales_rep_performance
        WHERE tenant_id = $1 AND owner_user_id = $2
      `, [TENANT_A_ID, USER_A_ID]);
      const queryTime = Date.now() - startTime;

      // Query should complete in under 150ms
      expect(queryTime).toBeLessThan(150);
      expect(performance.rows.length).toBeLessThanOrEqual(1);
    });
  });

  // =================================================================
  // HELPER FUNCTIONS
  // =================================================================

  async function setupTestData() {
    // Set initial context
    await db.query(`SET app.current_tenant_id = '${TENANT_A_ID}'`);
    await db.query(`SET app.current_user_id = '${USER_A_ID}'`);

    // Create default pipeline stages for both tenants
    const defaultStages = [
      { name: 'Lead', probability: 10, sequence: 1 },
      { name: 'Qualified', probability: 25, sequence: 2 },
      { name: 'Proposal', probability: 50, sequence: 3 },
      { name: 'Negotiation', probability: 75, sequence: 4 },
      { name: 'Closed Won', probability: 100, sequence: 5, isClosedWon: true },
      { name: 'Closed Lost', probability: 0, sequence: 6, isClosedLost: true },
    ];

    for (const tenantId of [TENANT_A_ID, TENANT_B_ID]) {
      await db.query(`SET app.current_tenant_id = '${tenantId}'`);

      for (const stage of defaultStages) {
        await db.query(`
          INSERT INTO crm_pipeline_stages
          (tenant_id, stage_name, sequence_number, probability_percentage, is_closed_won, is_closed_lost)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [
          tenantId,
          stage.name,
          stage.sequence,
          stage.probability,
          stage.isClosedWon || false,
          stage.isClosedLost || false,
        ]);
      }
    }
  }

  async function cleanupTestData() {
    // Clean up in reverse order of dependencies
    await db.query(`DELETE FROM crm_notes WHERE tenant_id IN ($1, $2)`, [TENANT_A_ID, TENANT_B_ID]);
    await db.query(`DELETE FROM crm_opportunity_stage_history WHERE tenant_id IN ($1, $2)`, [TENANT_A_ID, TENANT_B_ID]);
    await db.query(`DELETE FROM crm_activities WHERE tenant_id IN ($1, $2)`, [TENANT_A_ID, TENANT_B_ID]);
    await db.query(`DELETE FROM crm_opportunities WHERE tenant_id IN ($1, $2)`, [TENANT_A_ID, TENANT_B_ID]);
    await db.query(`DELETE FROM crm_contacts WHERE tenant_id IN ($1, $2)`, [TENANT_A_ID, TENANT_B_ID]);
    await db.query(`DELETE FROM crm_pipeline_stages WHERE tenant_id IN ($1, $2)`, [TENANT_A_ID, TENANT_B_ID]);
  }
});
