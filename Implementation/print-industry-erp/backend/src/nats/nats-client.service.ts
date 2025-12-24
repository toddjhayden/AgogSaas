/**
 * NATS Jetstream Client Service
 * Layer 3: Orchestration - Agent Deliverable Communication
 *
 * Follows AGOG deliverable pattern:
 * - Agents publish FULL reports to NATS (5K-15K tokens)
 * - Agents return TINY completion notices (~200 tokens)
 * - 95% token savings on agent spawning
 */

import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  JsMsg,
  StorageType,
  RetentionPolicy,
  StreamConfig,
} from 'nats';

export interface AgentCompletionNotice {
  status: 'complete' | 'failed' | 'blocked';
  agent: string;
  task: string;
  nats_channel: string;
  summary: string;
  complexity: 'Simple' | 'Medium' | 'Complex';
  blockers?: string;
  ready_for_next_stage: boolean;
  completion_time: string;
  files_modified?: number;
  metadata?: Record<string, any>;
}

export interface NATSPublishOptions {
  agent: string;
  taskType: string;
  feature: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface NATSSubscribeOptions {
  agent?: string;
  taskType?: string;
  feature?: string;
  callback: (message: string, metadata: any) => void | Promise<void>;
}

/**
 * NATS Jetstream Client for Agent Deliverables
 *
 * Channel Pattern: agog.deliverables.[agent].[type].[feature]
 *
 * Agents:
 * - cynthia: Research
 * - sylvia: Critique/Gate
 * - roy: Backend
 * - jen: Frontend
 * - billy: QA
 * - priya: Statistics
 */
export class NATSClient {
  private nc: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private jsm: JetStreamManager | null = null;
  private codec = StringCodec();
  private natsUrl: string;

  // Agent stream names (one stream per agent)
  private readonly AGENT_STREAMS = {
    cynthia: 'agog_features_research',
    sylvia: 'agog_features_critique',
    roy: 'agog_features_backend',
    jen: 'agog_features_frontend',
    billy: 'agog_features_qa',
    priya: 'agog_features_statistics',
  };

  constructor(natsUrl?: string) {
    this.natsUrl = natsUrl || process.env.NATS_URL || 'nats://localhost:4222';
  }

  /**
   * Connect to NATS server and setup Jetstream
   */
  async connect(): Promise<void> {
    try {
      console.log(`[NATS] Connecting to ${this.natsUrl}...`);

      // Parse credentials from URL if embedded (format: nats://user:pass@host:port)
      // or use separate user/password env vars
      const connectionOptions: any = {
        servers: this.natsUrl,
        name: 'agogsaas-orchestrator',
        reconnect: true,
        maxReconnectAttempts: -1, // Infinite reconnects
        reconnectTimeWait: 1000, // 1 second
      };

      // If credentials are not in URL, check for separate env vars
      if (!this.natsUrl.includes('@')) {
        const user = process.env.NATS_USER;
        const pass = process.env.NATS_PASSWORD;
        if (user && pass) {
          connectionOptions.user = user;
          connectionOptions.pass = pass;
          console.log(`[NATS] Using credentials for user: ${user}`);
        }
      } else {
        console.log('[NATS] Using credentials from URL');
      }

      this.nc = await connect(connectionOptions);

      console.log(`[NATS] Connected to ${this.nc.getServer()}`);

      // Setup Jetstream
      this.js = this.nc.jetstream();
      this.jsm = await this.nc.jetstreamManager();

      // Initialize streams for all agents
      await this.initializeStreams();

      console.log('[NATS] Jetstream initialized');
    } catch (error: any) {
      console.error('[NATS] Connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Jetstream streams for agent deliverables
   * One stream per agent with wildcard subjects
   */
  private async initializeStreams(): Promise<void> {
    if (!this.jsm) {
      throw new Error('[NATS] Jetstream manager not initialized');
    }

    for (const [agent, streamName] of Object.entries(this.AGENT_STREAMS)) {
      try {
        // Try to get existing stream
        await this.jsm.streams.info(streamName);
        console.log(`[NATS] Stream ${streamName} already exists`);
      } catch (error) {
        // Stream doesn't exist, create it
        console.log(`[NATS] Creating stream: ${streamName}`);

        const streamConfig: Partial<StreamConfig> = {
          name: streamName,
          subjects: [`agog.deliverables.${agent}.>`], // Wildcard: matches all subtopics
          storage: StorageType.File,
          retention: RetentionPolicy.Limits,
          max_msgs: 10000, // Max 10K messages per stream
          max_bytes: 1024 * 1024 * 1024, // 1GB per stream
          max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days (in nanoseconds)
          max_msg_size: 10 * 1024 * 1024, // 10MB per message (large reports)
          discard: 'old' as any, // Discard old messages when limits reached
          duplicate_window: 2 * 60 * 1_000_000_000, // 2 minutes deduplication
        };

        await this.jsm.streams.add(streamConfig);
        console.log(`[NATS] ✅ Stream ${streamName} created`);
      }
    }

    console.log('[NATS] All agent streams initialized');
  }

  /**
   * Publish agent deliverable (full report) to NATS
   *
   * @param options - Publishing options
   * @returns Message ID
   */
  async publishDeliverable(options: NATSPublishOptions): Promise<string> {
    if (!this.js) {
      throw new Error('[NATS] Not connected to Jetstream');
    }

    const { agent, taskType, feature, content, metadata } = options;

    // Build channel name: agog.deliverables.[agent].[type].[feature]
    const channel = `agog.deliverables.${agent}.${taskType}.${feature}`;

    // Prepare message with metadata
    const message = {
      content,
      metadata: {
        agent,
        taskType,
        feature,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };

    const encodedMessage = this.codec.encode(JSON.stringify(message));

    try {
      const pubAck = await this.js.publish(channel, encodedMessage);

      console.log(`[NATS] ✅ Published to ${channel}`);
      console.log(`[NATS] Message ID: ${pubAck.seq}, Stream: ${pubAck.stream}`);

      return `${pubAck.stream}.${pubAck.seq}`;
    } catch (error: any) {
      console.error(`[NATS] Failed to publish to ${channel}:`, error.message);
      throw error;
    }
  }

  /**
   * Subscribe to agent deliverables
   *
   * @param options - Subscription options
   * @returns Subscription (for cleanup)
   */
  async subscribeToDeliverables(options: NATSSubscribeOptions): Promise<void> {
    if (!this.js) {
      throw new Error('[NATS] Not connected to Jetstream');
    }

    const { agent, taskType, feature, callback } = options;

    // Build subject pattern
    let subject: string;
    if (agent && taskType && feature) {
      subject = `agog.deliverables.${agent}.${taskType}.${feature}`;
    } else if (agent && taskType) {
      subject = `agog.deliverables.${agent}.${taskType}.*`;
    } else if (agent) {
      subject = `agog.deliverables.${agent}.>`;
    } else {
      subject = 'agog.deliverables.>'; // All deliverables
    }

    console.log(`[NATS] Subscribing to: ${subject}`);

    // Create or get consumer
    const streamName = agent ? this.AGENT_STREAMS[agent as keyof typeof this.AGENT_STREAMS] : 'agog_features_research';

    try {
      const consumer = await this.js.consumers.get(streamName);

      const messages = await consumer.consume();

      // Process messages
      for await (const msg of messages) {
        try {
          const data = JSON.parse(this.codec.decode(msg.data));
          await callback(data.content, data.metadata);
          msg.ack();
        } catch (error: any) {
          console.error(`[NATS] Error processing message:`, error.message);
          msg.nak(); // Negative acknowledgment - will be redelivered
        }
      }
    } catch (error: any) {
      console.error(`[NATS] Subscription failed:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch specific deliverable by agent, type, and feature
   * Returns the latest message matching the criteria
   */
  async fetchDeliverable(agent: string, taskType: string, feature: string): Promise<any> {
    if (!this.js) {
      throw new Error('[NATS] Not connected to Jetstream');
    }

    const channel = `agog.deliverables.${agent}.${taskType}.${feature}`;
    const streamName = this.AGENT_STREAMS[agent as keyof typeof this.AGENT_STREAMS];

    if (!streamName) {
      throw new Error(`[NATS] Unknown agent: ${agent}`);
    }

    try {
      // Get the last message on this subject
      const msg = await this.jsm!.streams.getMessage(streamName, {
        last_by_subj: channel,
      });

      const data = JSON.parse(this.codec.decode(msg.data));

      console.log(`[NATS] Fetched deliverable: ${channel}`);

      return {
        content: data.content,
        metadata: data.metadata,
        sequence: msg.seq,
        timestamp: msg.time,
      };
    } catch (error: any) {
      if (error.message.includes('no message found')) {
        console.log(`[NATS] No deliverable found for: ${channel}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Get stream information (useful for monitoring)
   */
  async getStreamInfo(agent: string): Promise<any> {
    if (!this.jsm) {
      throw new Error('[NATS] Jetstream manager not initialized');
    }

    const streamName = this.AGENT_STREAMS[agent as keyof typeof this.AGENT_STREAMS];

    if (!streamName) {
      throw new Error(`[NATS] Unknown agent: ${agent}`);
    }

    return await this.jsm.streams.info(streamName);
  }

  /**
   * Get all streams status (for monitoring dashboard)
   */
  async getAllStreamsStatus(): Promise<any[]> {
    if (!this.jsm) {
      throw new Error('[NATS] Jetstream manager not initialized');
    }

    const streams = await this.jsm.streams.list().next();
    const statuses = [];

    for (const stream of streams) {
      const info = await this.jsm.streams.info(stream.config.name);
      statuses.push({
        name: stream.config.name,
        messages: info.state.messages,
        bytes: info.state.bytes,
        first_seq: info.state.first_seq,
        last_seq: info.state.last_seq,
        consumer_count: info.state.consumer_count,
      });
    }

    return statuses;
  }

  /**
   * Create completion notice helper
   * Small JSON object to return to orchestrator
   */
  static createCompletionNotice(
    agent: string,
    task: string,
    channel: string,
    summary: string,
    options?: Partial<AgentCompletionNotice>
  ): AgentCompletionNotice {
    return {
      status: 'complete',
      agent,
      task,
      nats_channel: channel,
      summary,
      complexity: options?.complexity || 'Medium',
      blockers: options?.blockers || 'None',
      ready_for_next_stage: options?.ready_for_next_stage !== false,
      completion_time: new Date().toISOString(),
      files_modified: options?.files_modified,
      metadata: options?.metadata,
    };
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
      console.log('[NATS] Connection closed');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.nc !== null && !this.nc.isClosed();
  }
}
