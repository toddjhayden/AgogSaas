/**
 * Quote Event Publisher Service
 * REQ-STRATEGIC-AUTO-1767108044308: Real-Time Collaboration & Live Editing for Quotes
 *
 * Publishes quote-related events to NATS for real-time collaboration features.
 * Events are consumed by GraphQL subscription resolvers to push updates to clients.
 *
 * Event Subject Hierarchy (simplified per Sylvia's recommendation):
 * - quote.event.{tenantId}.{quoteId}
 * - presence.event.{tenantId}.{quoteId}
 */

import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JSONCodec, ConnectionOptions } from 'nats';

// =====================================================
// EVENT INTERFACES
// =====================================================

export interface QuoteEventBase {
  eventId: string;
  timestamp: string;
  tenantId: string;
  quoteId: string;
  userId: string;
  userName: string;
}

export interface QuoteUpdatedEvent extends QuoteEventBase {
  eventType: 'QUOTE_UPDATED';
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  version: number;
}

export interface QuoteLineUpdatedEvent extends QuoteEventBase {
  eventType: 'QUOTE_LINE_UPDATED';
  lineId: string;
  lineNumber: number;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  version: number;
}

export interface QuoteLineAddedEvent extends QuoteEventBase {
  eventType: 'QUOTE_LINE_ADDED';
  lineId: string;
  lineNumber: number;
  lineData: any;
}

export interface QuoteLineDeletedEvent extends QuoteEventBase {
  eventType: 'QUOTE_LINE_DELETED';
  lineId: string;
  lineNumber: number;
}

export interface QuoteStatusChangedEvent extends QuoteEventBase {
  eventType: 'QUOTE_STATUS_CHANGED';
  oldStatus: string;
  newStatus: string;
  version: number;
}

export interface QuoteTotalsRecalculatedEvent extends QuoteEventBase {
  eventType: 'QUOTE_TOTALS_RECALCULATED';
  newTotals: {
    subtotal: number;
    taxAmount: number;
    shippingAmount: number;
    discountAmount: number;
    totalAmount: number;
  };
}

export type QuoteEvent =
  | QuoteUpdatedEvent
  | QuoteLineUpdatedEvent
  | QuoteLineAddedEvent
  | QuoteLineDeletedEvent
  | QuoteStatusChangedEvent
  | QuoteTotalsRecalculatedEvent;

// =====================================================
// PRESENCE EVENT INTERFACES
// =====================================================

export interface PresenceEventBase {
  eventId: string;
  timestamp: string;
  tenantId: string;
  quoteId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface UserJoinedEvent extends PresenceEventBase {
  eventType: 'USER_JOINED';
  sessionId: string;
}

export interface UserLeftEvent extends PresenceEventBase {
  eventType: 'USER_LEFT';
  sessionId: string;
}

export interface UserCursorMovedEvent extends PresenceEventBase {
  eventType: 'CURSOR_MOVED';
  sessionId: string;
  lineId?: string;
  field?: string;
  cursorPosition?: number;
}

export interface UserEditingStatusChangedEvent extends PresenceEventBase {
  eventType: 'EDITING_STATUS_CHANGED';
  sessionId: string;
  isEditing: boolean;
  field?: string;
  lineId?: string;
}

export type PresenceEvent =
  | UserJoinedEvent
  | UserLeftEvent
  | UserCursorMovedEvent
  | UserEditingStatusChangedEvent;

// =====================================================
// SERVICE IMPLEMENTATION
// =====================================================

@Injectable()
export class QuoteEventPublisherService implements OnModuleInit, OnModuleDestroy {
  private natsConnection: NatsConnection | null = null;
  private jsonCodec = JSONCodec();
  private isConnected = false;

  constructor() {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  // =====================================================
  // NATS CONNECTION MANAGEMENT
  // =====================================================

  private async connect(): Promise<void> {
    try {
      const connectionOptions: ConnectionOptions = {
        servers: process.env.NATS_URL || 'nats://nats:4222',
        name: 'quote-event-publisher',
        reconnect: true,
        maxReconnectAttempts: -1, // Infinite reconnects
        reconnectTimeWait: 2000, // 2 seconds between reconnect attempts
      };

      // Add auth if configured
      if (process.env.NATS_USER && process.env.NATS_PASSWORD) {
        connectionOptions.user = process.env.NATS_USER;
        connectionOptions.pass = process.env.NATS_PASSWORD;
      }

      this.natsConnection = await connect(connectionOptions);
      this.isConnected = true;

      console.log('[QuoteEventPublisher] Connected to NATS server');

      // Handle connection events
      (async () => {
        for await (const status of this.natsConnection!.status()) {
          console.log(`[QuoteEventPublisher] NATS status: ${status.type}`);

          if (status.type === 'disconnect' || status.type === 'reconnecting') {
            this.isConnected = false;
          } else if (status.type === 'reconnect') {
            this.isConnected = true;
          }
        }
      })();

    } catch (error) {
      console.error('[QuoteEventPublisher] Failed to connect to NATS:', error);
      this.isConnected = false;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.natsConnection) {
      await this.natsConnection.drain();
      this.natsConnection = null;
      this.isConnected = false;
      console.log('[QuoteEventPublisher] Disconnected from NATS');
    }
  }

  // =====================================================
  // QUOTE EVENT PUBLISHING
  // =====================================================

  /**
   * Publish quote updated event
   */
  async publishQuoteUpdated(
    tenantId: string,
    quoteId: string,
    userId: string,
    userName: string,
    changes: Array<{ field: string; oldValue: any; newValue: any }>,
    version: number
  ): Promise<void> {
    const event: QuoteUpdatedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      eventType: 'QUOTE_UPDATED',
      changes,
      version
    };

    await this.publish(`quote.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish quote line updated event
   */
  async publishQuoteLineUpdated(
    tenantId: string,
    quoteId: string,
    lineId: string,
    lineNumber: number,
    userId: string,
    userName: string,
    changes: Array<{ field: string; oldValue: any; newValue: any }>,
    version: number
  ): Promise<void> {
    const event: QuoteLineUpdatedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      eventType: 'QUOTE_LINE_UPDATED',
      lineId,
      lineNumber,
      changes,
      version
    };

    await this.publish(`quote.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish quote line added event
   */
  async publishQuoteLineAdded(
    tenantId: string,
    quoteId: string,
    lineId: string,
    lineNumber: number,
    userId: string,
    userName: string,
    lineData: any
  ): Promise<void> {
    const event: QuoteLineAddedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      eventType: 'QUOTE_LINE_ADDED',
      lineId,
      lineNumber,
      lineData
    };

    await this.publish(`quote.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish quote line deleted event
   */
  async publishQuoteLineDeleted(
    tenantId: string,
    quoteId: string,
    lineId: string,
    lineNumber: number,
    userId: string,
    userName: string
  ): Promise<void> {
    const event: QuoteLineDeletedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      eventType: 'QUOTE_LINE_DELETED',
      lineId,
      lineNumber
    };

    await this.publish(`quote.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish quote status changed event
   */
  async publishQuoteStatusChanged(
    tenantId: string,
    quoteId: string,
    userId: string,
    userName: string,
    oldStatus: string,
    newStatus: string,
    version: number
  ): Promise<void> {
    const event: QuoteStatusChangedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      eventType: 'QUOTE_STATUS_CHANGED',
      oldStatus,
      newStatus,
      version
    };

    await this.publish(`quote.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish quote totals recalculated event
   */
  async publishQuoteTotalsRecalculated(
    tenantId: string,
    quoteId: string,
    userId: string,
    userName: string,
    newTotals: {
      subtotal: number;
      taxAmount: number;
      shippingAmount: number;
      discountAmount: number;
      totalAmount: number;
    }
  ): Promise<void> {
    const event: QuoteTotalsRecalculatedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      eventType: 'QUOTE_TOTALS_RECALCULATED',
      newTotals
    };

    await this.publish(`quote.event.${tenantId}.${quoteId}`, event);
  }

  // =====================================================
  // PRESENCE EVENT PUBLISHING
  // =====================================================

  /**
   * Publish user joined event
   */
  async publishUserJoined(
    tenantId: string,
    quoteId: string,
    sessionId: string,
    userId: string,
    userName: string,
    userEmail: string
  ): Promise<void> {
    const event: UserJoinedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      userEmail,
      eventType: 'USER_JOINED',
      sessionId
    };

    await this.publish(`presence.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish user left event
   */
  async publishUserLeft(
    tenantId: string,
    quoteId: string,
    sessionId: string,
    userId: string,
    userName: string,
    userEmail: string
  ): Promise<void> {
    const event: UserLeftEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      userEmail,
      eventType: 'USER_LEFT',
      sessionId
    };

    await this.publish(`presence.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish cursor moved event
   */
  async publishCursorMoved(
    tenantId: string,
    quoteId: string,
    sessionId: string,
    userId: string,
    userName: string,
    userEmail: string,
    lineId?: string,
    field?: string,
    cursorPosition?: number
  ): Promise<void> {
    const event: UserCursorMovedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      userEmail,
      eventType: 'CURSOR_MOVED',
      sessionId,
      lineId,
      field,
      cursorPosition
    };

    await this.publish(`presence.event.${tenantId}.${quoteId}`, event);
  }

  /**
   * Publish editing status changed event
   */
  async publishEditingStatusChanged(
    tenantId: string,
    quoteId: string,
    sessionId: string,
    userId: string,
    userName: string,
    userEmail: string,
    isEditing: boolean,
    field?: string,
    lineId?: string
  ): Promise<void> {
    const event: UserEditingStatusChangedEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tenantId,
      quoteId,
      userId,
      userName,
      userEmail,
      eventType: 'EDITING_STATUS_CHANGED',
      sessionId,
      isEditing,
      field,
      lineId
    };

    await this.publish(`presence.event.${tenantId}.${quoteId}`, event);
  }

  // =====================================================
  // INTERNAL HELPERS
  // =====================================================

  private async publish(subject: string, event: QuoteEvent | PresenceEvent): Promise<void> {
    if (!this.isConnected || !this.natsConnection) {
      console.warn(`[QuoteEventPublisher] Not connected to NATS, skipping event: ${subject}`);
      return;
    }

    try {
      const data = this.jsonCodec.encode(event);
      this.natsConnection.publish(subject, data);

      console.log(`[QuoteEventPublisher] Published event to ${subject}:`, event.eventType);
    } catch (error) {
      console.error(`[QuoteEventPublisher] Failed to publish event to ${subject}:`, error);
    }
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // =====================================================
  // PUBLIC STATUS METHODS
  // =====================================================

  /**
   * Check if service is connected to NATS
   */
  isReady(): boolean {
    return this.isConnected && this.natsConnection !== null;
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; server?: string } {
    return {
      connected: this.isConnected,
      server: process.env.NATS_URL || 'nats://nats:4222'
    };
  }
}
