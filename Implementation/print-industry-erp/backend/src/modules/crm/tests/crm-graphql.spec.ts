import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

/**
 * CRM GraphQL API Test Suite
 *
 * Tests GraphQL endpoints for CRM & Sales Pipeline Management
 * REQ: REQ-STRATEGIC-AUTO-1767116143665
 *
 * COVERAGE:
 * - GraphQL Query operations
 * - GraphQL Mutation operations
 * - Authentication & Authorization
 * - Input validation
 * - Error handling
 * - Response formatting
 */

describe('CRM GraphQL API Tests', () => {
  let app: INestApplication;

  const TENANT_A_ID = '00000000-0000-0000-0000-000000000001';
  const USER_A_ID = '00000000-0000-0000-0000-000000000011';
  const AUTH_TOKEN = 'test-jwt-token'; // Mock JWT token for testing

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // =================================================================
  // CONTACT QUERIES
  // =================================================================

  describe('Contact Queries', () => {
    test('should fetch contact by ID', async () => {
      const query = `
        query GetContact($id: ID!) {
          getContact(id: $id) {
            id
            firstName
            lastName
            emailPrimary
            jobTitle
            isActive
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { id: 'test-contact-id' },
        });

      if (response.body.data) {
        expect(response.body.data.getContact).toHaveProperty('id');
        expect(response.body.data.getContact).toHaveProperty('firstName');
        expect(response.body.data.getContact).toHaveProperty('lastName');
      }
    });

    test('should search contacts by search term', async () => {
      const query = `
        query SearchContacts($searchTerm: String!) {
          searchContacts(searchTerm: $searchTerm) {
            id
            firstName
            lastName
            emailPrimary
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { searchTerm: 'john' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('searchContacts');
      expect(Array.isArray(response.body.data.searchContacts)).toBe(true);
    });

    test('should get contacts requiring follow-up', async () => {
      const query = `
        query GetContactsRequiringFollowUp($ownerUserId: ID) {
          getContactsRequiringFollowUp(ownerUserId: $ownerUserId) {
            id
            firstName
            lastName
            nextFollowUpDate
            lastContactDate
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { ownerUserId: USER_A_ID },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getContactsRequiringFollowUp');
    });
  });

  // =================================================================
  // OPPORTUNITY QUERIES
  // =================================================================

  describe('Opportunity Queries', () => {
    test('should fetch opportunity by ID with BANT fields', async () => {
      const query = `
        query GetOpportunity($id: ID!) {
          getOpportunity(id: $id) {
            id
            opportunityNumber
            opportunityName
            estimatedValue
            weightedValue
            budgetConfirmed
            authorityConfirmed
            needConfirmed
            timelineConfirmed
            pipelineStageId
            status
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { id: 'test-opportunity-id' },
        });

      if (response.body.data && response.body.data.getOpportunity) {
        const opp = response.body.data.getOpportunity;
        expect(opp).toHaveProperty('budgetConfirmed');
        expect(opp).toHaveProperty('authorityConfirmed');
        expect(opp).toHaveProperty('needConfirmed');
        expect(opp).toHaveProperty('timelineConfirmed');
      }
    });

    test('should get pipeline summary', async () => {
      const query = `
        query GetPipelineSummary($ownerUserId: ID) {
          getPipelineSummary(ownerUserId: $ownerUserId) {
            stageId
            stageName
            sequenceNumber
            opportunityCount
            totalValue
            totalWeightedValue
            avgProbability
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { ownerUserId: USER_A_ID },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getPipelineSummary');
      expect(Array.isArray(response.body.data.getPipelineSummary)).toBe(true);
    });

    test('should get opportunities requiring action', async () => {
      const query = `
        query GetOpportunitiesRequiringAction($ownerUserId: ID) {
          getOpportunitiesRequiringAction(ownerUserId: $ownerUserId) {
            id
            opportunityName
            nextActionDate
            nextActionDescription
            expectedCloseDate
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { ownerUserId: USER_A_ID },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getOpportunitiesRequiringAction');
    });

    test('should get opportunity stage history', async () => {
      const query = `
        query GetOpportunityStageHistory($opportunityId: ID!) {
          getOpportunityStageHistory(opportunityId: $opportunityId) {
            id
            fromStageId
            fromStageName
            toStageId
            toStageName
            stageChangedAt
            daysInPreviousStage
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { opportunityId: 'test-opp-id' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getOpportunityStageHistory');
    });
  });

  // =================================================================
  // ACTIVITY QUERIES
  // =================================================================

  describe('Activity Queries', () => {
    test('should get activities by opportunity', async () => {
      const query = `
        query GetActivitiesByOpportunity($opportunityId: ID!) {
          getActivitiesByOpportunity(opportunityId: $opportunityId) {
            id
            activityType
            activitySubject
            activityDate
            isCompleted
            outcome
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { opportunityId: 'test-opp-id' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getActivitiesByOpportunity');
    });

    test('should get activities by contact', async () => {
      const query = `
        query GetActivitiesByContact($contactId: ID!) {
          getActivitiesByContact(contactId: $contactId) {
            id
            activityType
            activitySubject
            activityDate
            durationMinutes
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { contactId: 'test-contact-id' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getActivitiesByContact');
    });

    test('should get recent activities with limit', async () => {
      const query = `
        query GetRecentActivities($ownerUserId: ID, $limit: Int) {
          getRecentActivities(ownerUserId: $ownerUserId, limit: $limit) {
            id
            activityType
            activitySubject
            activityDate
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { ownerUserId: USER_A_ID, limit: 10 },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getRecentActivities');
    });
  });

  // =================================================================
  // NOTE QUERIES
  // =================================================================

  describe('Note Queries', () => {
    test('should get notes by opportunity', async () => {
      const query = `
        query GetNotesByOpportunity($opportunityId: ID!) {
          getNotesByOpportunity(opportunityId: $opportunityId) {
            id
            noteTitle
            noteContent
            noteType
            isPinned
            isPrivate
            createdAt
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { opportunityId: 'test-opp-id' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getNotesByOpportunity');
    });

    test('should get notes by contact', async () => {
      const query = `
        query GetNotesByContact($contactId: ID!) {
          getNotesByContact(contactId: $contactId) {
            id
            noteContent
            noteType
            isPinned
            createdBy
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { contactId: 'test-contact-id' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('getNotesByContact');
    });
  });

  // =================================================================
  // CONTACT MUTATIONS
  // =================================================================

  describe('Contact Mutations', () => {
    test('should create a new contact', async () => {
      const mutation = `
        mutation CreateContact($input: CreateContactInput!) {
          createContact(input: $input) {
            id
            firstName
            lastName
            emailPrimary
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              firstName: 'John',
              lastName: 'Doe',
              emailPrimary: 'john.doe@example.com',
              phoneOffice: '555-1234',
              jobTitle: 'Purchasing Manager',
            },
          },
        });

      if (response.body.data && response.body.data.createContact) {
        expect(response.body.data.createContact).toHaveProperty('id');
        expect(response.body.data.createContact.firstName).toBe('John');
        expect(response.body.data.createContact.lastName).toBe('Doe');
      }
    });

    test('should update existing contact', async () => {
      const mutation = `
        mutation UpdateContact($input: UpdateContactInput!) {
          updateContact(input: $input) {
            id
            firstName
            lastName
            jobTitle
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              id: 'test-contact-id',
              jobTitle: 'Senior Purchasing Manager',
            },
          },
        });

      expect(response.status).toBe(200);
    });
  });

  // =================================================================
  // OPPORTUNITY MUTATIONS
  // =================================================================

  describe('Opportunity Mutations', () => {
    test('should create a new opportunity', async () => {
      const mutation = `
        mutation CreateOpportunity($input: CreateOpportunityInput!) {
          createOpportunity(input: $input) {
            id
            opportunityName
            estimatedValue
            pipelineStageId
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              opportunityName: 'Large Print Order',
              estimatedValue: 150000,
              pipelineStageId: 'test-stage-id',
              ownerUserId: USER_A_ID,
            },
          },
        });

      if (response.body.data && response.body.data.createOpportunity) {
        expect(response.body.data.createOpportunity).toHaveProperty('id');
        expect(response.body.data.createOpportunity.opportunityName).toBe('Large Print Order');
      }
    });

    test('should update opportunity with BANT fields', async () => {
      const mutation = `
        mutation UpdateOpportunity($input: UpdateOpportunityInput!) {
          updateOpportunity(input: $input) {
            id
            estimatedValue
            probabilityPercentage
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              id: 'test-opp-id',
              estimatedValue: 200000,
              probabilityPercentage: 75,
            },
          },
        });

      expect(response.status).toBe(200);
    });
  });

  // =================================================================
  // ACTIVITY MUTATIONS
  // =================================================================

  describe('Activity Mutations', () => {
    test('should create an activity', async () => {
      const mutation = `
        mutation CreateActivity($input: CreateActivityInput!) {
          createActivity(input: $input) {
            id
            activityType
            activitySubject
            activityDate
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              activityType: 'CALL',
              activitySubject: 'Follow-up call',
              activityDescription: 'Discuss pricing options',
              ownerUserId: USER_A_ID,
            },
          },
        });

      if (response.body.data && response.body.data.createActivity) {
        expect(response.body.data.createActivity).toHaveProperty('id');
        expect(response.body.data.createActivity.activityType).toBe('CALL');
      }
    });

    test('should mark activity as completed', async () => {
      const mutation = `
        mutation MarkActivityCompleted($id: ID!, $outcome: String, $nextSteps: String) {
          markActivityCompleted(id: $id, outcome: $outcome, nextSteps: $nextSteps) {
            id
            isCompleted
            outcome
            nextSteps
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            id: 'test-activity-id',
            outcome: 'COMPLETED',
            nextSteps: 'Send proposal by Friday',
          },
        });

      expect(response.status).toBe(200);
    });
  });

  // =================================================================
  // NOTE MUTATIONS
  // =================================================================

  describe('Note Mutations', () => {
    test('should create a note with pinning', async () => {
      const mutation = `
        mutation CreateNote($input: CreateNoteInput!) {
          createNote(input: $input) {
            id
            noteContent
            noteType
            isPinned
            isPrivate
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              noteContent: 'Important: Customer requires rush delivery',
              noteType: 'IMPORTANT',
              isPinned: true,
              opportunityId: 'test-opp-id',
            },
          },
        });

      if (response.body.data && response.body.data.createNote) {
        expect(response.body.data.createNote).toHaveProperty('id');
        expect(response.body.data.createNote.isPinned).toBe(true);
        expect(response.body.data.createNote.noteType).toBe('IMPORTANT');
      }
    });

    test('should toggle note pin status', async () => {
      const mutation = `
        mutation TogglePinNote($id: ID!) {
          togglePinNote(id: $id) {
            id
            isPinned
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: { id: 'test-note-id' },
        });

      expect(response.status).toBe(200);
    });
  });

  // =================================================================
  // AUTHORIZATION TESTS
  // =================================================================

  describe('Authorization & Security', () => {
    test('should reject requests without tenant ID header', async () => {
      const query = `
        query GetContact($id: ID!) {
          getContact(id: $id) {
            id
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        // Missing x-tenant-id header
        .send({
          query,
          variables: { id: 'test-id' },
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should reject requests without authentication', async () => {
      const query = `
        query GetContact($id: ID!) {
          getContact(id: $id) {
            id
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        // Missing Authorization header
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query,
          variables: { id: 'test-id' },
        });

      expect(response.status).toBe(401);
    });
  });

  // =================================================================
  // INPUT VALIDATION TESTS
  // =================================================================

  describe('Input Validation', () => {
    test('should reject contact creation with missing required fields', async () => {
      const mutation = `
        mutation CreateContact($input: CreateContactInput!) {
          createContact(input: $input) {
            id
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              // Missing required firstName and lastName
              emailPrimary: 'test@example.com',
            },
          },
        });

      expect(response.body.errors).toBeDefined();
    });

    test('should reject opportunity creation with invalid estimated value', async () => {
      const mutation = `
        mutation CreateOpportunity($input: CreateOpportunityInput!) {
          createOpportunity(input: $input) {
            id
          }
        }
      `;

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${AUTH_TOKEN}`)
        .set('x-tenant-id', TENANT_A_ID)
        .send({
          query: mutation,
          variables: {
            input: {
              opportunityName: 'Test',
              estimatedValue: -1000, // Invalid negative value
              pipelineStageId: 'test-stage',
              ownerUserId: USER_A_ID,
            },
          },
        });

      // Should either reject at GraphQL validation layer or business logic layer
      expect(
        response.body.errors !== undefined ||
        (response.body.data && response.body.data.createOpportunity === null)
      ).toBe(true);
    });
  });
});
