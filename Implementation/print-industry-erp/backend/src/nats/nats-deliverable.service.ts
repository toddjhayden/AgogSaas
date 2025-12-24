/**
 * NATS Deliverable Service
 * High-level service for agent deliverable operations
 *
 * Provides simplified interface for:
 * - Publishing agent reports
 * - Fetching previous agent work
 * - Creating completion notices
 * - Monitoring deliverable status
 */

import { NATSClient, AgentCompletionNotice, NATSPublishOptions } from './nats-client.service';

export interface PublishReportOptions {
  agent: 'cynthia' | 'sylvia' | 'roy' | 'jen' | 'billy' | 'priya';
  taskType: 'research' | 'critique' | 'backend' | 'frontend' | 'qa' | 'statistics';
  featureName: string;
  reportContent: string;
  metadata?: Record<string, any>;
}

export interface FetchReportOptions {
  agent: 'cynthia' | 'sylvia' | 'roy' | 'jen' | 'billy' | 'priya';
  taskType: 'research' | 'critique' | 'backend' | 'frontend' | 'qa' | 'statistics';
  featureName: string;
}

export interface AgentReport {
  content: string;
  metadata: {
    agent: string;
    taskType: string;
    feature: string;
    timestamp: string;
    [key: string]: any;
  };
  sequence: number;
  timestamp: Date;
}

/**
 * NATS Deliverable Service
 * Simplified interface for agent deliverable operations
 */
export class NATSDeliverableService {
  private client: NATSClient;

  constructor(natsUrl?: string) {
    this.client = new NATSClient(natsUrl);
  }

  /**
   * Initialize the service (connect to NATS)
   */
  async initialize(): Promise<void> {
    await this.client.connect();
    console.log('[NATSDeliverable] Service initialized');
  }

  /**
   * Publish an agent's full report to NATS
   *
   * Example:
   * ```typescript
   * await deliverableService.publishReport({
   *   agent: 'cynthia',
   *   taskType: 'research',
   *   featureName: 'customer-search',
   *   reportContent: fullResearchReport,
   *   metadata: { complexity: 'Medium' }
   * });
   * ```
   */
  async publishReport(options: PublishReportOptions): Promise<string> {
    const { agent, taskType, featureName, reportContent, metadata } = options;

    console.log(`[NATSDeliverable] Publishing ${agent} ${taskType} report for: ${featureName}`);

    const messageId = await this.client.publishDeliverable({
      agent,
      taskType,
      feature: featureName,
      content: reportContent,
      metadata,
    });

    console.log(`[NATSDeliverable] ✅ Published ${agent} report (ID: ${messageId})`);

    return messageId;
  }

  /**
   * Fetch a previous agent's report
   *
   * Example:
   * ```typescript
   * const report = await deliverableService.fetchReport({
   *   agent: 'cynthia',
   *   taskType: 'research',
   *   featureName: 'customer-search'
   * });
   *
   * console.log(report.content); // Full research report
   * ```
   */
  async fetchReport(options: FetchReportOptions): Promise<AgentReport | null> {
    const { agent, taskType, featureName } = options;

    console.log(`[NATSDeliverable] Fetching ${agent} ${taskType} report for: ${featureName}`);

    const deliverable = await this.client.fetchDeliverable(agent, taskType, featureName);

    if (!deliverable) {
      console.log(`[NATSDeliverable] No report found`);
      return null;
    }

    return {
      content: deliverable.content,
      metadata: deliverable.metadata,
      sequence: deliverable.sequence,
      timestamp: new Date(deliverable.timestamp),
    };
  }

  /**
   * Create a completion notice for an agent
   * This is what agents return (tiny JSON, ~200 tokens)
   *
   * Example:
   * ```typescript
   * const notice = deliverableService.createCompletionNotice(
   *   'cynthia',
   *   'customer-search',
   *   'agog.deliverables.cynthia.research.customer-search',
   *   'Researched customer search requirements and patterns',
   *   {
   *     complexity: 'Medium',
   *     files_modified: 0,
   *     ready_for_next_stage: true
   *   }
   * );
   * ```
   */
  createCompletionNotice(
    agent: string,
    task: string,
    channel: string,
    summary: string,
    options?: Partial<AgentCompletionNotice>
  ): AgentCompletionNotice {
    return NATSClient.createCompletionNotice(agent, task, channel, summary, options);
  }

  /**
   * Build channel name for agent deliverable
   */
  buildChannelName(agent: string, taskType: string, featureName: string): string {
    return `agog.deliverables.${agent}.${taskType}.${featureName}`;
  }

  /**
   * Get all agent stream statuses (for monitoring)
   */
  async getStreamStatuses(): Promise<any[]> {
    return await this.client.getAllStreamsStatus();
  }

  /**
   * Get specific agent stream status
   */
  async getAgentStreamStatus(agent: string): Promise<any> {
    return await this.client.getStreamInfo(agent);
  }

  /**
   * Close the service
   */
  async close(): Promise<void> {
    await this.client.close();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }
}

/**
 * Example Usage
 *
 * WORKFLOW:
 * ========
 *
 * 1. Cynthia does research:
 * ```typescript
 * // Publish full report (5K-15K tokens)
 * await natsService.publishReport({
 *   agent: 'cynthia',
 *   taskType: 'research',
 *   featureName: 'customer-search',
 *   reportContent: FULL_RESEARCH_REPORT,
 *   metadata: { files_analyzed: 15 }
 * });
 *
 * // Return tiny completion notice (~200 tokens)
 * return natsService.createCompletionNotice(
 *   'cynthia',
 *   'customer-search',
 *   'agog.deliverables.cynthia.research.customer-search',
 *   'Researched customer search patterns and requirements',
 *   { complexity: 'Medium', ready_for_next_stage: true }
 * );
 * ```
 *
 * 2. Sylvia fetches Cynthia's report for critique:
 * ```typescript
 * // Fetch full report (5K-15K tokens) from NATS
 * const cynthiaReport = await natsService.fetchReport({
 *   agent: 'cynthia',
 *   taskType: 'research',
 *   featureName: 'customer-search'
 * });
 *
 * // Do critique...
 * const critiqueResult = performCritique(cynthiaReport.content);
 *
 * // Publish full critique
 * await natsService.publishReport({
 *   agent: 'sylvia',
 *   taskType: 'critique',
 *   featureName: 'customer-search',
 *   reportContent: FULL_CRITIQUE_REPORT
 * });
 *
 * // Return tiny notice
 * return natsService.createCompletionNotice(...);
 * ```
 *
 * 3. Roy fetches both reports for backend implementation:
 * ```typescript
 * // Fetch previous work
 * const research = await natsService.fetchReport({
 *   agent: 'cynthia',
 *   taskType: 'research',
 *   featureName: 'customer-search'
 * });
 *
 * const critique = await natsService.fetchReport({
 *   agent: 'sylvia',
 *   taskType: 'critique',
 *   featureName: 'customer-search'
 * });
 *
 * // Implement backend...
 * // Publish implementation report...
 * // Return tiny notice...
 * ```
 *
 * TOKEN SAVINGS:
 * =============
 * Without NATS: Spawn Roy with full context (15K tokens)
 * With NATS: Spawn Roy with tiny notice (200 tokens), fetch full reports on demand
 * Savings: ~95% reduction in spawning tokens
 */
