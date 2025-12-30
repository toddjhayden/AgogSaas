import { gql } from '@apollo/client';

// ============================================================================
// Fragment Definitions
// ============================================================================

export const CONTACT_FRAGMENT = gql`
  fragment ContactFields on Contact {
    id
    tenantId
    firstName
    lastName
    middleName
    suffix
    customerId
    jobTitle
    department
    emailPrimary
    emailSecondary
    phoneOffice
    phoneMobile
    phoneHome
    linkedinUrl
    twitterHandle
    websiteUrl
    addressLine1
    addressLine2
    city
    state
    postalCode
    country
    contactType
    leadSource
    industry
    companySize
    preferredContactMethod
    communicationFrequency
    timezone
    languageCode
    interests
    painPoints
    buyingAuthority
    lastContactDate
    lastContactType
    nextFollowUpDate
    engagementScore
    ownerUserId
    isActive
    doNotContact
    emailOptOut
    marketingConsent
    marketingConsentDate
    marketingConsentSource
    notes
    createdAt
    updatedAt
  }
`;

export const PIPELINE_STAGE_FRAGMENT = gql`
  fragment PipelineStageFields on PipelineStage {
    id
    tenantId
    stageName
    stageDescription
    sequenceNumber
    probabilityPercentage
    isClosedWon
    isClosedLost
    targetDaysInStage
    isActive
  }
`;

export const OPPORTUNITY_FRAGMENT = gql`
  fragment OpportunityFields on Opportunity {
    id
    tenantId
    opportunityNumber
    opportunityName
    description
    customerId
    primaryContactId
    pipelineStageId
    stageEnteredAt
    estimatedValue
    currencyCode
    probabilityPercentage
    weightedValue
    expectedCloseDate
    actualCloseDate
    opportunityType
    leadSource
    productCategories
    primaryProductId
    competitors
    ourCompetitiveAdvantage
    decisionMakers
    decisionCriteria
    budgetConfirmed
    authorityConfirmed
    needConfirmed
    timelineConfirmed
    ownerUserId
    teamMembers
    lastActivityDate
    nextActionDate
    nextActionDescription
    status
    lostReason
    lostReasonNotes
    quoteId
    salesOrderId
    tags
    notes
    createdAt
    updatedAt
  }
`;

export const ACTIVITY_FRAGMENT = gql`
  fragment ActivityFields on Activity {
    id
    tenantId
    activityType
    activitySubject
    activityDescription
    opportunityId
    contactId
    customerId
    activityDate
    durationMinutes
    location
    attendees
    externalAttendees
    outcome
    nextSteps
    emailSent
    emailOpened
    emailClicked
    ownerUserId
    isCompleted
    createdAt
    updatedAt
  }
`;

export const NOTE_FRAGMENT = gql`
  fragment NoteFields on Note {
    id
    tenantId
    noteTitle
    noteContent
    opportunityId
    contactId
    customerId
    activityId
    noteType
    isPinned
    isPrivate
    createdBy
    createdAt
    updatedAt
  }
`;

export const OPPORTUNITY_STAGE_HISTORY_FRAGMENT = gql`
  fragment OpportunityStageHistoryFields on OpportunityStageHistory {
    id
    opportunityId
    fromStageId
    fromStageName
    toStageId
    toStageName
    stageChangedAt
    daysInPreviousStage
    changedByUserId
    changeReason
  }
`;

export const PIPELINE_SUMMARY_FRAGMENT = gql`
  fragment PipelineSummaryFields on PipelineSummary {
    stageId
    stageName
    sequenceNumber
    opportunityCount
    totalValue
    totalWeightedValue
    avgProbability
  }
`;

export const ACTIVITY_SUMMARY_FRAGMENT = gql`
  fragment ActivitySummaryFields on ActivitySummary {
    activityType
    activityCount
    totalMinutes
    completedCount
  }
`;

// ============================================================================
// Queries - Contacts
// ============================================================================

export const GET_CONTACT = gql`
  ${CONTACT_FRAGMENT}
  query GetContact($id: ID!) {
    getContact(id: $id) {
      ...ContactFields
    }
  }
`;

export const GET_CONTACTS_BY_CUSTOMER = gql`
  ${CONTACT_FRAGMENT}
  query GetContactsByCustomer($customerId: ID!) {
    getContactsByCustomer(customerId: $customerId) {
      ...ContactFields
    }
  }
`;

export const GET_CONTACTS_BY_OWNER = gql`
  ${CONTACT_FRAGMENT}
  query GetContactsByOwner($ownerUserId: ID!) {
    getContactsByOwner(ownerUserId: $ownerUserId) {
      ...ContactFields
    }
  }
`;

export const SEARCH_CONTACTS = gql`
  ${CONTACT_FRAGMENT}
  query SearchContacts($searchTerm: String!) {
    searchContacts(searchTerm: $searchTerm) {
      ...ContactFields
    }
  }
`;

export const GET_CONTACTS_REQUIRING_FOLLOW_UP = gql`
  ${CONTACT_FRAGMENT}
  query GetContactsRequiringFollowUp($ownerUserId: ID) {
    getContactsRequiringFollowUp(ownerUserId: $ownerUserId) {
      ...ContactFields
    }
  }
`;

// ============================================================================
// Queries - Pipeline Stages
// ============================================================================

export const GET_PIPELINE_STAGES = gql`
  ${PIPELINE_STAGE_FRAGMENT}
  query GetPipelineStages {
    getPipelineStages {
      ...PipelineStageFields
    }
  }
`;

export const GET_PIPELINE_STAGE = gql`
  ${PIPELINE_STAGE_FRAGMENT}
  query GetPipelineStage($id: ID!) {
    getPipelineStage(id: $id) {
      ...PipelineStageFields
    }
  }
`;

// ============================================================================
// Queries - Opportunities
// ============================================================================

export const GET_OPPORTUNITY = gql`
  ${OPPORTUNITY_FRAGMENT}
  query GetOpportunity($id: ID!) {
    getOpportunity(id: $id) {
      ...OpportunityFields
    }
  }
`;

export const GET_OPPORTUNITIES_BY_CUSTOMER = gql`
  ${OPPORTUNITY_FRAGMENT}
  query GetOpportunitiesByCustomer($customerId: ID!) {
    getOpportunitiesByCustomer(customerId: $customerId) {
      ...OpportunityFields
    }
  }
`;

export const GET_OPPORTUNITIES_BY_OWNER = gql`
  ${OPPORTUNITY_FRAGMENT}
  query GetOpportunitiesByOwner($ownerUserId: ID!, $status: String) {
    getOpportunitiesByOwner(ownerUserId: $ownerUserId, status: $status) {
      ...OpportunityFields
    }
  }
`;

export const GET_OPPORTUNITIES_BY_STAGE = gql`
  ${OPPORTUNITY_FRAGMENT}
  query GetOpportunitiesByStage($pipelineStageId: ID!) {
    getOpportunitiesByStage(pipelineStageId: $pipelineStageId) {
      ...OpportunityFields
    }
  }
`;

export const GET_PIPELINE_SUMMARY = gql`
  ${PIPELINE_SUMMARY_FRAGMENT}
  query GetPipelineSummary($ownerUserId: ID) {
    getPipelineSummary(ownerUserId: $ownerUserId) {
      ...PipelineSummaryFields
    }
  }
`;

export const GET_OPPORTUNITIES_REQUIRING_ACTION = gql`
  ${OPPORTUNITY_FRAGMENT}
  query GetOpportunitiesRequiringAction($ownerUserId: ID) {
    getOpportunitiesRequiringAction(ownerUserId: $ownerUserId) {
      ...OpportunityFields
    }
  }
`;

export const GET_OPPORTUNITY_STAGE_HISTORY = gql`
  ${OPPORTUNITY_STAGE_HISTORY_FRAGMENT}
  query GetOpportunityStageHistory($opportunityId: ID!) {
    getOpportunityStageHistory(opportunityId: $opportunityId) {
      ...OpportunityStageHistoryFields
    }
  }
`;

// ============================================================================
// Queries - Activities
// ============================================================================

export const GET_ACTIVITY = gql`
  ${ACTIVITY_FRAGMENT}
  query GetActivity($id: ID!) {
    getActivity(id: $id) {
      ...ActivityFields
    }
  }
`;

export const GET_ACTIVITIES_BY_OPPORTUNITY = gql`
  ${ACTIVITY_FRAGMENT}
  query GetActivitiesByOpportunity($opportunityId: ID!) {
    getActivitiesByOpportunity(opportunityId: $opportunityId) {
      ...ActivityFields
    }
  }
`;

export const GET_ACTIVITIES_BY_CONTACT = gql`
  ${ACTIVITY_FRAGMENT}
  query GetActivitiesByContact($contactId: ID!) {
    getActivitiesByContact(contactId: $contactId) {
      ...ActivityFields
    }
  }
`;

export const GET_ACTIVITIES_BY_CUSTOMER = gql`
  ${ACTIVITY_FRAGMENT}
  query GetActivitiesByCustomer($customerId: ID!) {
    getActivitiesByCustomer(customerId: $customerId) {
      ...ActivityFields
    }
  }
`;

export const GET_ACTIVITIES_BY_OWNER = gql`
  ${ACTIVITY_FRAGMENT}
  query GetActivitiesByOwner($ownerUserId: ID!, $limit: Int) {
    getActivitiesByOwner(ownerUserId: $ownerUserId, limit: $limit) {
      ...ActivityFields
    }
  }
`;

export const GET_RECENT_ACTIVITIES = gql`
  ${ACTIVITY_FRAGMENT}
  query GetRecentActivities($ownerUserId: ID, $limit: Int) {
    getRecentActivities(ownerUserId: $ownerUserId, limit: $limit) {
      ...ActivityFields
    }
  }
`;

export const GET_ACTIVITY_SUMMARY = gql`
  ${ACTIVITY_SUMMARY_FRAGMENT}
  query GetActivitySummary($ownerUserId: ID!, $startDate: DateTime!, $endDate: DateTime!) {
    getActivitySummary(ownerUserId: $ownerUserId, startDate: $startDate, endDate: $endDate) {
      ...ActivitySummaryFields
    }
  }
`;

// ============================================================================
// Queries - Notes
// ============================================================================

export const GET_NOTE = gql`
  ${NOTE_FRAGMENT}
  query GetNote($id: ID!) {
    getNote(id: $id) {
      ...NoteFields
    }
  }
`;

export const GET_NOTES_BY_OPPORTUNITY = gql`
  ${NOTE_FRAGMENT}
  query GetNotesByOpportunity($opportunityId: ID!) {
    getNotesByOpportunity(opportunityId: $opportunityId) {
      ...NoteFields
    }
  }
`;

export const GET_NOTES_BY_CONTACT = gql`
  ${NOTE_FRAGMENT}
  query GetNotesByContact($contactId: ID!) {
    getNotesByContact(contactId: $contactId) {
      ...NoteFields
    }
  }
`;

export const GET_NOTES_BY_CUSTOMER = gql`
  ${NOTE_FRAGMENT}
  query GetNotesByCustomer($customerId: ID!) {
    getNotesByCustomer(customerId: $customerId) {
      ...NoteFields
    }
  }
`;

// ============================================================================
// Mutations - Contacts
// ============================================================================

export const CREATE_CONTACT = gql`
  ${CONTACT_FRAGMENT}
  mutation CreateContact($input: CreateContactInput!) {
    createContact(input: $input) {
      ...ContactFields
    }
  }
`;

export const UPDATE_CONTACT = gql`
  ${CONTACT_FRAGMENT}
  mutation UpdateContact($input: UpdateContactInput!) {
    updateContact(input: $input) {
      ...ContactFields
    }
  }
`;

export const DELETE_CONTACT = gql`
  mutation DeleteContact($id: ID!) {
    deleteContact(id: $id)
  }
`;

// ============================================================================
// Mutations - Opportunities
// ============================================================================

export const CREATE_OPPORTUNITY = gql`
  ${OPPORTUNITY_FRAGMENT}
  mutation CreateOpportunity($input: CreateOpportunityInput!) {
    createOpportunity(input: $input) {
      ...OpportunityFields
    }
  }
`;

export const UPDATE_OPPORTUNITY = gql`
  ${OPPORTUNITY_FRAGMENT}
  mutation UpdateOpportunity($input: UpdateOpportunityInput!) {
    updateOpportunity(input: $input) {
      ...OpportunityFields
    }
  }
`;

export const DELETE_OPPORTUNITY = gql`
  mutation DeleteOpportunity($id: ID!) {
    deleteOpportunity(id: $id)
  }
`;

// ============================================================================
// Mutations - Activities
// ============================================================================

export const CREATE_ACTIVITY = gql`
  ${ACTIVITY_FRAGMENT}
  mutation CreateActivity($input: CreateActivityInput!) {
    createActivity(input: $input) {
      ...ActivityFields
    }
  }
`;

export const MARK_ACTIVITY_COMPLETED = gql`
  ${ACTIVITY_FRAGMENT}
  mutation MarkActivityCompleted($id: ID!, $outcome: String, $nextSteps: String) {
    markActivityCompleted(id: $id, outcome: $outcome, nextSteps: $nextSteps) {
      ...ActivityFields
    }
  }
`;

export const DELETE_ACTIVITY = gql`
  mutation DeleteActivity($id: ID!) {
    deleteActivity(id: $id)
  }
`;

// ============================================================================
// Mutations - Notes
// ============================================================================

export const CREATE_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation CreateNote($input: CreateNoteInput!) {
    createNote(input: $input) {
      ...NoteFields
    }
  }
`;

export const UPDATE_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation UpdateNote($id: ID!, $noteContent: String!, $noteTitle: String) {
    updateNote(id: $id, noteContent: $noteContent, noteTitle: $noteTitle) {
      ...NoteFields
    }
  }
`;

export const TOGGLE_PIN_NOTE = gql`
  ${NOTE_FRAGMENT}
  mutation TogglePinNote($id: ID!) {
    togglePinNote(id: $id) {
      ...NoteFields
    }
  }
`;

export const DELETE_NOTE = gql`
  mutation DeleteNote($id: ID!) {
    deleteNote(id: $id)
  }
`;

// ============================================================================
// Mutations - Pipeline Management
// ============================================================================

export const INITIALIZE_DEFAULT_PIPELINE_STAGES = gql`
  mutation InitializeDefaultPipelineStages {
    initializeDefaultPipelineStages
  }
`;
