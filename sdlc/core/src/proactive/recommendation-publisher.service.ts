/**
 * Recommendation Publisher
 * Subscribes to agent recommendations and inserts into SDLC Control database
 *
 * UNIFIED MODEL: Recommendations are just requests that require approval.
 * All recommendations go directly into owner_requests with:
 *   - requires_approval = true
 *   - approval_status = 'pending'
 *   - current_phase = 'pending_approval'
 *
 * Once approved by a human, they move to 'backlog' and enter the normal workflow.
 *
 * ENHANCED: Now includes semantic duplicate detection using embeddings
 * to prevent similar recommendations from being created.
 */

import { connect, NatsConnection } from 'nats';
import { getSDLCDatabase, SDLCDatabaseService } from '../sdlc-control/sdlc-database.service';
import { SDLCApiClient, createSDLCApiClient } from '../api/sdlc-api.client';
import { MCPMemoryClient } from '../mcp/mcp-client.service';

export interface Recommendation {
  reqNumber: string;
  title: string;
  owner: 'marcus' | 'sarah' | 'alex';
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  businessValue: string;
  requirements: string[];
  generatedBy: string;
  generatedAt: string;
  riceScore?: {
    reach: number;
    impact: number;
    confidence: number;
    effort: number;
    total: number;
  };
}

export class RecommendationPublisherService {
  private nc!: NatsConnection;
  private db!: SDLCDatabaseService;
  private apiClient: SDLCApiClient | null = null;
  private useCloudApi = false;
  private useLocalDb = false;
  private memoryClient: MCPMemoryClient;
  private isRunning = false;

  // Similarity threshold for duplicate detection (0.85 = 85% similar)
  private readonly SIMILARITY_THRESHOLD = 0.85;

  constructor() {
    this.memoryClient = new MCPMemoryClient();
  }

  async initialize(): Promise<void> {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';
    const user = process.env.NATS_USER;
    const pass = process.env.NATS_PASSWORD;

    // Try cloud API first, then fall back to local database
    this.apiClient = createSDLCApiClient();

    if (this.apiClient) {
      const apiHealthy = await this.apiClient.healthCheck();
      if (apiHealthy) {
        this.useCloudApi = true;
        console.log(`[RecommendationPublisher] ✅ SDLC Cloud API connected (${process.env.SDLC_API_URL})`);
      } else {
        console.warn('[RecommendationPublisher] Cloud API health check failed - falling back to local DB');
        this.apiClient = null;
      }
    }

    if (!this.useCloudApi) {
      // Try local mode - use direct database connection
      try {
        this.db = getSDLCDatabase();
        const dbHealthy = await this.db.healthCheck();
        if (dbHealthy) {
          this.useLocalDb = true;
          console.log('[RecommendationPublisher] ✅ SDLC database connection verified (direct)');
        } else {
          console.error('[RecommendationPublisher] ❌ Local SDLC database health check failed');
        }
      } catch (error: any) {
        console.error(`[RecommendationPublisher] ❌ Local SDLC database connection failed: ${error.message}`);
      }
    }

    // If neither cloud API nor local DB available, fail with clear error
    if (!this.useCloudApi && !this.useLocalDb) {
      console.error('[RecommendationPublisher] ❌ FATAL: No SDLC connection available');
      console.error('[RecommendationPublisher] To fix: set SDLC_API_URL env var OR start local sdlc-db container');
      throw new Error('[RecommendationPublisher] SDLC connection required - neither cloud API nor local database is accessible');
    }

    this.nc = await connect({
      servers: natsUrl,
      user,
      pass,
      name: 'recommendation-publisher'
    });

    console.log('[RecommendationPublisher] Connected to NATS');
  }

  /**
   * Start listening for recommendations
   */
  async startDaemon(): Promise<void> {
    if (this.isRunning) {
      console.log('[RecommendationPublisher] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[RecommendationPublisher] Starting daemon...');

    // Subscribe to all recommendation streams
    await this.subscribeToRecommendations('strategic'); // value-chain-expert
    await this.subscribeToRecommendations('inventory');  // Marcus-po
    await this.subscribeToRecommendations('sales');      // Sarah-po
    await this.subscribeToRecommendations('procurement'); // Alex-po

    console.log('[RecommendationPublisher] ✅ Subscribed to all recommendation streams');
    console.log('[RecommendationPublisher] ✅ Writing to SDLC Control database (recommendations table)');
  }

  /**
   * Subscribe to a recommendation stream
   */
  private async subscribeToRecommendations(domain: string): Promise<void> {
    const subject = `agog.recommendations.${domain}`;

    const sub = this.nc.subscribe(subject);

    (async () => {
      for await (const msg of sub) {
        try {
          const recommendation = JSON.parse(msg.string());
          console.log(`[RecommendationPublisher] Received recommendation from ${domain}: ${recommendation.reqNumber}`);

          await this.processRecommendation(recommendation, domain);
        } catch (error: any) {
          console.error(`[RecommendationPublisher] Error processing ${domain} recommendation:`, error.message);
        }
      }
    })();

    console.log(`[RecommendationPublisher] Subscribed to ${subject}`);
  }

  /**
   * Process a recommendation and insert into owner_requests (unified model)
   * UNIFIED: Recommendations go directly into owner_requests with requires_approval=true
   * ENHANCED: Includes semantic similarity check using embeddings
   */
  private async processRecommendation(rec: Recommendation, domain: string): Promise<void> {
    // Generate REQ number (unified naming - all requests use REQ- prefix)
    const reqNumber = rec.reqNumber.startsWith('REQ-STRATEGIC-AUTO-')
      ? `REQ-${rec.reqNumber.replace('REQ-STRATEGIC-AUTO-', '')}`
      : rec.reqNumber.startsWith('REQ-')
        ? rec.reqNumber
        : rec.reqNumber.startsWith('REC-')
          ? rec.reqNumber.replace('REC-', 'REQ-')  // Convert legacy REC- to REQ-
          : `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Check 1: Exact duplicate by req_number
    let exists = false;
    if (this.useCloudApi && this.apiClient) {
      exists = await this.apiClient.requestExists(reqNumber);
    } else if (this.useLocalDb && this.db) {
      const existing = await this.db.queryOne<{ id: string }>(
        'SELECT id FROM owner_requests WHERE req_number = $1',
        [reqNumber]
      );
      exists = !!existing;
    }

    if (exists) {
      console.log(`[RecommendationPublisher] Exact duplicate detected: ${reqNumber} - skipping`);
      return;
    }

    // Check 2: Semantic similarity check using embeddings
    // This prevents creating recommendations that are semantically similar to existing ones
    const semanticDuplicate = await this.checkSemanticDuplicate(rec.title, rec.businessValue);
    if (semanticDuplicate) {
      console.log(`[RecommendationPublisher] Semantic duplicate detected for "${rec.title}" - similar to existing: "${semanticDuplicate.title}" (similarity: ${semanticDuplicate.similarity.toFixed(2)})`);
      return;
    }

    // Map priority (P0-P4 → catastrophic/critical/high/medium/low)
    const priorityMap: Record<string, string> = {
      'P0': 'catastrophic',
      'P1': 'critical',
      'P2': 'high',
      'P3': 'medium',
      'P4': 'low'
    };

    // Map domain to request type
    const typeMap: Record<string, string> = {
      'strategic': 'enhancement',
      'inventory': 'enhancement',
      'sales': 'enhancement',
      'procurement': 'enhancement'
    };

    // Map owner to affected BU
    const buMap: Record<string, string> = {
      'marcus': 'supply-chain',
      'sarah': 'sales-engagement',
      'alex': 'supply-chain'
    };

    // Format requirements as description
    const description = rec.requirements.join('\n- ');
    const fullDescription = `**Requirements:**\n- ${description}`;
    const rationale = `Generated by ${rec.generatedBy} during ${domain} analysis`;
    const priority = priorityMap[rec.priority] || 'medium';
    const primaryBu = buMap[rec.owner] || 'core-infra';
    const impactLevel = rec.priority === 'P0' || rec.priority === 'P1' || rec.priority === 'P2' ? 'high' : 'medium';

    // Insert into owner_requests (unified model) - requires approval before entering workflow
    if (this.useCloudApi && this.apiClient) {
      // Cloud mode - use HTTP API to create request requiring approval
      const result = await this.apiClient.createRequest({
        reqNumber,
        title: rec.title,
        description: fullDescription,
        requestType: typeMap[domain] || 'enhancement',
        priority,
        primaryBu,
        assignedTo: undefined,  // No assignment until approved
        source: 'recommendation',
        tags: ['recommendation', domain, 'pending-approval'],
        affectedBus: [primaryBu],
      });

      if (result) {
        // Update with approval-specific fields
        await this.apiClient.updateRequestApproval(reqNumber, {
          requiresApproval: true,
          approvalStatus: 'pending',
          recommendedByAgent: rec.generatedBy,
          rationale,
          expectedBenefits: rec.businessValue,
          impactLevel,
        });
        console.log(`[RecommendationPublisher] ✅ Created ${reqNumber} (requires approval) via cloud API`);
      } else {
        console.error(`[RecommendationPublisher] Failed to create ${reqNumber} via cloud API`);
        return;
      }
    } else if (this.useLocalDb && this.db) {
      // Local mode - direct database insert into owner_requests
      await this.db.query(
        `INSERT INTO owner_requests (
          req_number,
          title,
          description,
          request_type,
          priority,
          primary_bu,
          affected_bus,
          current_phase,
          source,
          tags,
          -- Approval workflow fields
          requires_approval,
          approval_status,
          -- Recommendation-specific fields
          recommended_by_agent,
          rationale,
          expected_benefits,
          impact_level,
          discovered_during
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_approval', 'recommendation', $8, TRUE, 'pending', $9, $10, $11, $12, $13)`,
        [
          reqNumber,
          rec.title,
          fullDescription,
          typeMap[domain] || 'enhancement',
          priority,
          primaryBu,
          [primaryBu],
          ['recommendation', domain, 'pending-approval'],
          rec.generatedBy,
          rationale,
          rec.businessValue,
          impactLevel,
          `${domain} analysis`
        ]
      );

      console.log(`[RecommendationPublisher] ✅ Inserted ${reqNumber} (requires approval) into local database`);
    }

    // Store in memory system for future semantic duplicate detection
    await this.storeRecommendationInMemory(reqNumber, rec.title, rec.businessValue, domain);

    // Publish event to NATS for GUI updates
    try {
      await this.nc.publish('agog.sdlc.requests.new', Buffer.from(JSON.stringify({
        reqNumber,
        title: rec.title,
        domain,
        priority,
        requiresApproval: true,
        timestamp: new Date().toISOString()
      })));
    } catch (error: any) {
      console.warn('[RecommendationPublisher] Failed to publish new request event:', error.message);
    }
  }

  /**
   * Check for semantically similar recommendations using embedding search
   * Returns the similar recommendation if found, null otherwise
   */
  private async checkSemanticDuplicate(
    title: string,
    businessValue: string
  ): Promise<{ title: string; similarity: number } | null> {
    try {
      // Create search query combining title and business value
      const searchQuery = `${title}. ${businessValue}`;

      // Search for similar recommendations in memory
      const similarMemories = await this.memoryClient.searchMemories({
        query: searchQuery,
        memory_types: ['recommendation'],
        limit: 3,
        min_relevance: this.SIMILARITY_THRESHOLD,
      });

      if (similarMemories.length > 0) {
        const topMatch = similarMemories[0];
        // Extract title from stored content (format: "TITLE: {title}\nVALUE: {businessValue}")
        const titleMatch = topMatch.content.match(/TITLE:\s*(.+?)(?:\n|$)/);
        const matchedTitle = titleMatch ? titleMatch[1].trim() : topMatch.content.substring(0, 50);

        return {
          title: matchedTitle,
          similarity: topMatch.relevance_score || 0,
        };
      }

      return null;
    } catch (error: any) {
      // Log warning but don't block recommendation creation on embedding failure
      console.warn(`[RecommendationPublisher] Semantic duplicate check failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Store recommendation in memory system for future duplicate detection
   */
  private async storeRecommendationInMemory(
    recNumber: string,
    title: string,
    businessValue: string,
    domain: string
  ): Promise<void> {
    try {
      await this.memoryClient.storeMemory({
        agent_id: 'recommendation-publisher',
        memory_type: 'recommendation',
        content: `TITLE: ${title}\nVALUE: ${businessValue}`,
        metadata: {
          recNumber,
          domain,
          storedAt: new Date().toISOString(),
        },
      });
      console.log(`[RecommendationPublisher] 🧠 Stored ${recNumber} in memory for future duplicate detection`);
    } catch (error: any) {
      // Don't fail the recommendation creation if memory storage fails
      console.warn(`[RecommendationPublisher] Failed to store in memory: ${error.message}`);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  async close(): Promise<void> {
    await this.stop();
    await this.nc.close();
  }
}
