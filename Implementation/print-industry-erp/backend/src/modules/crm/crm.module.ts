/**
 * CRM Module
 *
 * Handles integrated CRM and sales pipeline management including:
 * - Contact management with GDPR compliance
 * - Opportunity tracking through customizable pipeline stages
 * - Activity logging (calls, emails, meetings, demos)
 * - Notes and collaboration
 * - Sales rep performance analytics
 *
 * Related Resolvers:
 * - CrmResolver
 */

import { Module } from '@nestjs/common';
import { CrmResolver } from '../../graphql/resolvers/crm.resolver';
import { ContactService } from './services/contact.service';
import { OpportunityService } from './services/opportunity.service';
import { ActivityService } from './services/activity.service';
import { PipelineStageService } from './services/pipeline-stage.service';
import { NoteService } from './services/note.service';

@Module({
  providers: [
    CrmResolver,
    ContactService,
    OpportunityService,
    ActivityService,
    PipelineStageService,
    NoteService,
  ],
  exports: [
    ContactService,
    OpportunityService,
    ActivityService,
    PipelineStageService,
    NoteService,
  ],
})
export class CrmModule {}
