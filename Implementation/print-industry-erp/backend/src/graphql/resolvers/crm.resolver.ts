import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { ContactService } from '../../modules/crm/services/contact.service';
import { OpportunityService } from '../../modules/crm/services/opportunity.service';
import { ActivityService } from '../../modules/crm/services/activity.service';
import { PipelineStageService } from '../../modules/crm/services/pipeline-stage.service';
import { NoteService } from '../../modules/crm/services/note.service';
import {
  CreateContactInput,
  UpdateContactInput,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  CreateActivityInput,
  CreateNoteInput,
} from '../../modules/crm/interfaces/crm.interfaces';

/**
 * CRM GraphQL Resolver
 *
 * Handles integrated CRM and sales pipeline operations:
 * - Contact management with GDPR compliance
 * - Opportunity tracking through pipeline stages
 * - Activity logging (calls, emails, meetings)
 * - Notes and collaboration
 * - Pipeline analytics and reporting
 */

@Resolver('CRM')
export class CrmResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly contactService: ContactService,
    private readonly opportunityService: OpportunityService,
    private readonly activityService: ActivityService,
    private readonly pipelineStageService: PipelineStageService,
    private readonly noteService: NoteService,
  ) {}

  // =====================================================
  // CONTACT QUERIES
  // =====================================================

  @Query('getContact')
  async getContact(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.contactService.getContactById(tenantId, id);
  }

  @Query('getContactsByCustomer')
  async getContactsByCustomer(
    @Args('customerId') customerId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.contactService.getContactsByCustomer(tenantId, customerId);
  }

  @Query('getContactsByOwner')
  async getContactsByOwner(
    @Args('ownerUserId') ownerUserId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.contactService.getContactsByOwner(tenantId, ownerUserId);
  }

  @Query('searchContacts')
  async searchContacts(
    @Args('searchTerm') searchTerm: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.contactService.searchContacts(tenantId, searchTerm);
  }

  @Query('getContactsRequiringFollowUp')
  async getContactsRequiringFollowUp(
    @Args('ownerUserId') ownerUserId: string | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.contactService.getContactsRequiringFollowUp(tenantId, ownerUserId ?? undefined);
  }

  // =====================================================
  // PIPELINE STAGE QUERIES
  // =====================================================

  @Query('getPipelineStages')
  async getPipelineStages(
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.pipelineStageService.getPipelineStages(tenantId);
  }

  @Query('getPipelineStage')
  async getPipelineStage(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.pipelineStageService.getPipelineStageById(tenantId, id);
  }

  // =====================================================
  // OPPORTUNITY QUERIES
  // =====================================================

  @Query('getOpportunity')
  async getOpportunity(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getOpportunityById(tenantId, id);
  }

  @Query('getOpportunitiesByCustomer')
  async getOpportunitiesByCustomer(
    @Args('customerId') customerId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getOpportunitiesByCustomer(tenantId, customerId);
  }

  @Query('getOpportunitiesByOwner')
  async getOpportunitiesByOwner(
    @Args('ownerUserId') ownerUserId: string,
    @Args('status') status: string | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getOpportunitiesByOwner(tenantId, ownerUserId, status ?? undefined);
  }

  @Query('getOpportunitiesByStage')
  async getOpportunitiesByStage(
    @Args('pipelineStageId') pipelineStageId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getOpportunitiesByStage(tenantId, pipelineStageId);
  }

  @Query('getPipelineSummary')
  async getPipelineSummary(
    @Args('ownerUserId') ownerUserId: string | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getPipelineSummary(tenantId, ownerUserId ?? undefined);
  }

  @Query('getOpportunitiesRequiringAction')
  async getOpportunitiesRequiringAction(
    @Args('ownerUserId') ownerUserId: string | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getOpportunitiesRequiringAction(tenantId, ownerUserId ?? undefined);
  }

  @Query('getOpportunityStageHistory')
  async getOpportunityStageHistory(
    @Args('opportunityId') opportunityId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.opportunityService.getStageHistory(tenantId, opportunityId);
  }

  // =====================================================
  // ACTIVITY QUERIES
  // =====================================================

  @Query('getActivity')
  async getActivity(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getActivityById(tenantId, id);
  }

  @Query('getActivitiesByOpportunity')
  async getActivitiesByOpportunity(
    @Args('opportunityId') opportunityId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getActivitiesByOpportunity(tenantId, opportunityId);
  }

  @Query('getActivitiesByContact')
  async getActivitiesByContact(
    @Args('contactId') contactId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getActivitiesByContact(tenantId, contactId);
  }

  @Query('getActivitiesByCustomer')
  async getActivitiesByCustomer(
    @Args('customerId') customerId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getActivitiesByCustomer(tenantId, customerId);
  }

  @Query('getActivitiesByOwner')
  async getActivitiesByOwner(
    @Args('ownerUserId') ownerUserId: string,
    @Args('limit') limit: number | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getActivitiesByOwner(tenantId, ownerUserId, limit || 50);
  }

  @Query('getRecentActivities')
  async getRecentActivities(
    @Args('ownerUserId') ownerUserId: string | null,
    @Args('limit') limit: number | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getRecentActivities(tenantId, ownerUserId ?? undefined, limit || 20);
  }

  @Query('getActivitySummary')
  async getActivitySummary(
    @Args('ownerUserId') ownerUserId: string,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    return this.activityService.getActivitySummary(tenantId, ownerUserId, startDate, endDate);
  }

  // =====================================================
  // NOTE QUERIES
  // =====================================================

  @Query('getNote')
  async getNote(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.getNoteById(tenantId, id, userId);
  }

  @Query('getNotesByOpportunity')
  async getNotesByOpportunity(
    @Args('opportunityId') opportunityId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.getNotesByOpportunity(tenantId, opportunityId, userId);
  }

  @Query('getNotesByContact')
  async getNotesByContact(
    @Args('contactId') contactId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.getNotesByContact(tenantId, contactId, userId);
  }

  @Query('getNotesByCustomer')
  async getNotesByCustomer(
    @Args('customerId') customerId: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.getNotesByCustomer(tenantId, customerId, userId);
  }

  // =====================================================
  // CONTACT MUTATIONS
  // =====================================================

  @Mutation('createContact')
  async createContact(
    @Args('input') input: CreateContactInput,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.contactService.createContact(tenantId, userId, input);
  }

  @Mutation('updateContact')
  async updateContact(
    @Args('input') input: UpdateContactInput,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.contactService.updateContact(tenantId, userId, input);
  }

  @Mutation('deleteContact')
  async deleteContact(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    await this.contactService.deleteContact(tenantId, id, userId);
    return true;
  }

  // =====================================================
  // OPPORTUNITY MUTATIONS
  // =====================================================

  @Mutation('createOpportunity')
  async createOpportunity(
    @Args('input') input: CreateOpportunityInput,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.opportunityService.createOpportunity(tenantId, userId, input);
  }

  @Mutation('updateOpportunity')
  async updateOpportunity(
    @Args('input') input: UpdateOpportunityInput,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.opportunityService.updateOpportunity(tenantId, userId, input);
  }

  @Mutation('deleteOpportunity')
  async deleteOpportunity(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    await this.opportunityService.deleteOpportunity(tenantId, id, userId);
    return true;
  }

  // =====================================================
  // ACTIVITY MUTATIONS
  // =====================================================

  @Mutation('createActivity')
  async createActivity(
    @Args('input') input: CreateActivityInput,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.activityService.createActivity(tenantId, userId, input);
  }

  @Mutation('markActivityCompleted')
  async markActivityCompleted(
    @Args('id') id: string,
    @Args('outcome') outcome: string | null,
    @Args('nextSteps') nextSteps: string | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.activityService.markActivityCompleted(tenantId, id, userId, outcome ?? undefined, nextSteps ?? undefined);
  }

  @Mutation('deleteActivity')
  async deleteActivity(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    await this.activityService.deleteActivity(tenantId, id, userId);
    return true;
  }

  // =====================================================
  // NOTE MUTATIONS
  // =====================================================

  @Mutation('createNote')
  async createNote(
    @Args('input') input: CreateNoteInput,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.createNote(tenantId, userId, input);
  }

  @Mutation('updateNote')
  async updateNote(
    @Args('id') id: string,
    @Args('noteContent') noteContent: string,
    @Args('noteTitle') noteTitle: string | null,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.updateNote(tenantId, id, userId, noteContent, noteTitle ?? undefined);
  }

  @Mutation('togglePinNote')
  async togglePinNote(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    return this.noteService.togglePinNote(tenantId, id, userId);
  }

  @Mutation('deleteNote')
  async deleteNote(
    @Args('id') id: string,
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    await this.noteService.deleteNote(tenantId, id, userId);
    return true;
  }

  // =====================================================
  // PIPELINE MANAGEMENT MUTATIONS
  // =====================================================

  @Mutation('initializeDefaultPipelineStages')
  async initializeDefaultPipelineStages(
    @Context() context: any
  ) {
    const tenantId = context.req.headers['x-tenant-id'];
    const userId = context.req.user?.id || context.req.headers['x-user-id'];
    await this.pipelineStageService.initializeDefaultStages(tenantId, userId);
    return true;
  }
}
