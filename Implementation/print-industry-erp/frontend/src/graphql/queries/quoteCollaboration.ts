import { gql } from '@apollo/client';

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to quote header changes (status, notes, totals, etc.)
 */
export const QUOTE_CHANGED_SUBSCRIPTION = gql`
  subscription QuoteChanged($quoteId: ID!) {
    quoteChanged(quoteId: $quoteId) {
      eventId
      timestamp
      quoteId
      tenantId
      userId
      userName
      changeType
      changes {
        field
        oldValue
        newValue
      }
      version
    }
  }
`;

/**
 * Subscribe to quote line changes (add, update, delete)
 */
export const QUOTE_LINE_CHANGED_SUBSCRIPTION = gql`
  subscription QuoteLineChanged($quoteId: ID!) {
    quoteLineChanged(quoteId: $quoteId) {
      eventId
      timestamp
      quoteId
      lineId
      lineNumber
      tenantId
      userId
      userName
      changeType
      changes {
        field
        oldValue
        newValue
      }
      version
    }
  }
`;

/**
 * Subscribe to presence updates (who's viewing/editing the quote)
 */
export const PRESENCE_UPDATED_SUBSCRIPTION = gql`
  subscription PresenceUpdated($quoteId: ID!) {
    presenceUpdated(quoteId: $quoteId) {
      quoteId
      activeUsers {
        userId
        userName
        userEmail
        status
        currentLine
        currentField
        cursorPosition
        lastSeen
      }
    }
  }
`;

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get active users currently editing a quote
 */
export const GET_ACTIVE_QUOTE_SESSIONS = gql`
  query GetActiveQuoteSessions($quoteId: ID!) {
    getActiveQuoteSessions(quoteId: $quoteId) {
      sessionId
      userId
      userName
      userEmail
      joinedAt
      lastHeartbeat
      currentLineId
      currentField
      cursorPosition
      isEditing
      status
    }
  }
`;

/**
 * Get change history for a quote (audit trail)
 */
export const GET_QUOTE_CHANGE_HISTORY = gql`
  query GetQuoteChangeHistory($quoteId: ID!, $limit: Int) {
    getQuoteChangeHistory(quoteId: $quoteId, limit: $limit) {
      id
      quoteId
      quoteLineId
      changedBy
      changedByName
      changedAt
      entityType
      fieldName
      oldValue
      newValue
      changeType
      sessionId
      wasConflict
      conflictResolution
      entityVersionBefore
      entityVersionAfter
    }
  }
`;

/**
 * Check if quote has been updated since a specific version
 */
export const HAS_QUOTE_BEEN_UPDATED = gql`
  query HasQuoteBeenUpdated($quoteId: ID!, $sinceVersion: Int!) {
    hasQuoteBeenUpdated(quoteId: $quoteId, sinceVersion: $sinceVersion)
  }
`;

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Update quote with optimistic locking (version check)
 */
export const UPDATE_QUOTE_WITH_VERSION_CHECK = gql`
  mutation UpdateQuoteWithVersionCheck($input: VersionedQuoteUpdateInput!) {
    updateQuoteWithVersionCheck(input: $input) {
      success
      quote {
        id
        quoteNumber
        status
        subtotal
        taxAmount
        shippingAmount
        discountAmount
        totalAmount
        totalCost
        marginAmount
        marginPercentage
        version
        updatedAt
        updatedBy
      }
      conflicts {
        field
        expectedVersion
        actualVersion
        currentValue
        attemptedValue
      }
    }
  }
`;

/**
 * Update quote line with optimistic locking (version check)
 */
export const UPDATE_QUOTE_LINE_WITH_VERSION_CHECK = gql`
  mutation UpdateQuoteLineWithVersionCheck($input: VersionedQuoteLineUpdateInput!) {
    updateQuoteLineWithVersionCheck(input: $input) {
      success
      quoteLine {
        id
        quoteId
        lineNumber
        productId
        productCode
        description
        quantityQuoted
        unitOfMeasure
        unitPrice
        lineAmount
        discountPercentage
        discountAmount
        unitCost
        lineCost
        lineMargin
        marginPercentage
        manufacturingStrategy
        leadTimeDays
        promisedDeliveryDate
        version
        updatedAt
        updatedBy
      }
      conflicts {
        field
        expectedVersion
        actualVersion
        currentValue
        attemptedValue
      }
    }
  }
`;

/**
 * Join a quote editing session (presence tracking)
 */
export const JOIN_QUOTE_SESSION = gql`
  mutation JoinQuoteSession($input: JoinQuoteSessionInput!) {
    joinQuoteSession(input: $input) {
      sessionId
      userId
      userName
      userEmail
      quoteId
      joinedAt
      lastHeartbeat
      status
    }
  }
`;

/**
 * Leave a quote editing session
 */
export const LEAVE_QUOTE_SESSION = gql`
  mutation LeaveQuoteSession($sessionId: ID!) {
    leaveQuoteSession(sessionId: $sessionId)
  }
`;

/**
 * Update session heartbeat (keep-alive and cursor position)
 */
export const UPDATE_SESSION_HEARTBEAT = gql`
  mutation UpdateSessionHeartbeat($input: UpdateSessionHeartbeatInput!) {
    updateSessionHeartbeat(input: $input)
  }
`;

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export interface QuoteChangedEvent {
  eventId: string;
  timestamp: string;
  quoteId: string;
  tenantId: string;
  userId: string;
  userName: string;
  changeType: 'HEADER_UPDATED' | 'STATUS_CHANGED' | 'NOTES_UPDATED' | 'RECALCULATED';
  changes: FieldChange[];
  version: number;
}

export interface QuoteLineChangedEvent {
  eventId: string;
  timestamp: string;
  quoteId: string;
  lineId: string;
  lineNumber: number;
  tenantId: string;
  userId: string;
  userName: string;
  changeType: 'LINE_ADDED' | 'LINE_UPDATED' | 'LINE_DELETED';
  changes: FieldChange[];
  version: number;
}

export interface PresenceEvent {
  quoteId: string;
  activeUsers: ActiveUser[];
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ActiveUser {
  userId: string;
  userName: string;
  userEmail: string;
  status: 'VIEWING' | 'EDITING' | 'IDLE';
  currentLine?: number;
  currentField?: string;
  cursorPosition?: number;
  lastSeen: string;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  quoteId: string;
  joinedAt: string;
  lastHeartbeat: string;
  currentLineId?: string;
  currentField?: string;
  cursorPosition?: number;
  isEditing: boolean;
  status: 'VIEWING' | 'EDITING' | 'IDLE';
}

export interface QuoteChangeRecord {
  id: string;
  quoteId: string;
  quoteLineId?: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  entityType: 'QUOTE' | 'QUOTE_LINE';
  fieldName: string;
  oldValue: any;
  newValue: any;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  sessionId?: string;
  wasConflict: boolean;
  conflictResolution?: 'ACCEPTED' | 'REJECTED' | 'MERGED';
  entityVersionBefore: number;
  entityVersionAfter: number;
}

export interface ConflictInfo {
  field: string;
  expectedVersion: number;
  actualVersion: number;
  currentValue: any;
  attemptedValue: any;
}

export interface QuoteCollaborationResult {
  success: boolean;
  quote: any;
  conflicts?: ConflictInfo[];
}

export interface QuoteLineCollaborationResult {
  success: boolean;
  quoteLine: any;
  conflicts?: ConflictInfo[];
}

export interface VersionedQuoteUpdateInput {
  quoteId: string;
  version: number;
  changes: Record<string, any>;
}

export interface VersionedQuoteLineUpdateInput {
  lineId: string;
  version: number;
  changes: Record<string, any>;
}

export interface JoinQuoteSessionInput {
  quoteId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface UpdateSessionHeartbeatInput {
  sessionId: string;
  currentLineId?: string;
  currentField?: string;
  cursorPosition?: number;
  isEditing?: boolean;
  status?: 'VIEWING' | 'EDITING' | 'IDLE';
}
