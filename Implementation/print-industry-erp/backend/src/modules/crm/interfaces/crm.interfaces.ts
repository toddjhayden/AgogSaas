/**
 * CRM Module Interfaces
 *
 * Type definitions for CRM entities and operations
 */

export interface Contact {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  customerId?: string;
  jobTitle?: string;
  department?: string;
  emailPrimary?: string;
  emailSecondary?: string;
  phoneOffice?: string;
  phoneMobile?: string;
  phoneHome?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  websiteUrl?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  contactType?: string;
  leadSource?: string;
  industry?: string;
  companySize?: string;
  preferredContactMethod?: string;
  communicationFrequency?: string;
  timezone?: string;
  languageCode?: string;
  interests?: string[];
  painPoints?: string[];
  buyingAuthority?: string;
  lastContactDate?: Date;
  lastContactType?: string;
  nextFollowUpDate?: Date;
  engagementScore?: number;
  ownerUserId?: string;
  isActive: boolean;
  doNotContact: boolean;
  emailOptOut: boolean;
  marketingConsent: boolean;
  marketingConsentDate?: Date;
  marketingConsentSource?: string;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface PipelineStage {
  id: string;
  tenantId: string;
  stageName: string;
  stageDescription?: string;
  sequenceNumber: number;
  probabilityPercentage: number;
  isClosedWon: boolean;
  isClosedLost: boolean;
  requiredFields?: Record<string, any>;
  autoActions?: Record<string, any>;
  targetDaysInStage?: number;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface Opportunity {
  id: string;
  tenantId: string;
  opportunityNumber: string;
  opportunityName: string;
  description?: string;
  customerId?: string;
  primaryContactId?: string;
  pipelineStageId: string;
  stageEnteredAt: Date;
  estimatedValue: number;
  currencyCode: string;
  probabilityPercentage?: number;
  weightedValue?: number;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  opportunityType?: string;
  leadSource?: string;
  productCategories?: string[];
  primaryProductId?: string;
  competitors?: string[];
  ourCompetitiveAdvantage?: string;
  decisionMakers?: string[];
  decisionCriteria?: string;
  budgetConfirmed: boolean;
  authorityConfirmed: boolean;
  needConfirmed: boolean;
  timelineConfirmed: boolean;
  ownerUserId: string;
  teamMembers?: string[];
  lastActivityDate?: Date;
  nextActionDate?: Date;
  nextActionDescription?: string;
  status: string;
  lostReason?: string;
  lostReasonNotes?: string;
  quoteId?: string;
  salesOrderId?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  notes?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface Activity {
  id: string;
  tenantId: string;
  activityType: string;
  activitySubject: string;
  activityDescription?: string;
  opportunityId?: string;
  contactId?: string;
  customerId?: string;
  activityDate: Date;
  durationMinutes?: number;
  location?: string;
  attendees?: string[];
  externalAttendees?: string[];
  outcome?: string;
  nextSteps?: string;
  emailSent: boolean;
  emailOpened: boolean;
  emailClicked: boolean;
  ownerUserId: string;
  attachmentUrls?: string[];
  isCompleted: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface Note {
  id: string;
  tenantId: string;
  noteTitle?: string;
  noteContent: string;
  opportunityId?: string;
  contactId?: string;
  customerId?: string;
  activityId?: string;
  noteType?: string;
  isPinned: boolean;
  isPrivate: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface OpportunityStageHistory {
  id: string;
  tenantId: string;
  opportunityId: string;
  fromStageId?: string;
  toStageId: string;
  stageChangedAt: Date;
  daysInPreviousStage?: number;
  changedByUserId: string;
  changeReason?: string;
}

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  customerId?: string;
  jobTitle?: string;
  department?: string;
  emailPrimary?: string;
  emailSecondary?: string;
  phoneOffice?: string;
  phoneMobile?: string;
  phoneHome?: string;
  contactType?: string;
  leadSource?: string;
  ownerUserId?: string;
  notes?: string;
}

export interface UpdateContactInput {
  id: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  emailPrimary?: string;
  phoneMobile?: string;
  nextFollowUpDate?: Date;
  ownerUserId?: string;
  notes?: string;
}

export interface CreateOpportunityInput {
  opportunityName: string;
  description?: string;
  customerId?: string;
  primaryContactId?: string;
  pipelineStageId: string;
  estimatedValue: number;
  currencyCode?: string;
  expectedCloseDate?: Date;
  opportunityType?: string;
  leadSource?: string;
  ownerUserId: string;
}

export interface UpdateOpportunityInput {
  id: string;
  opportunityName?: string;
  description?: string;
  pipelineStageId?: string;
  estimatedValue?: number;
  probabilityPercentage?: number;
  expectedCloseDate?: Date;
  nextActionDate?: Date;
  nextActionDescription?: string;
  status?: string;
  lostReason?: string;
  lostReasonNotes?: string;
}

export interface CreateActivityInput {
  activityType: string;
  activitySubject: string;
  activityDescription?: string;
  opportunityId?: string;
  contactId?: string;
  customerId?: string;
  activityDate?: Date;
  durationMinutes?: number;
  ownerUserId: string;
}

export interface CreateNoteInput {
  noteTitle?: string;
  noteContent: string;
  opportunityId?: string;
  contactId?: string;
  customerId?: string;
  activityId?: string;
  noteType?: string;
  isPinned?: boolean;
  isPrivate?: boolean;
}
