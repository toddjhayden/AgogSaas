import { spawn, ChildProcess } from 'child_process';
import { connect, NatsConnection } from 'nats';
import * as path from 'path';
import * as fs from 'fs';

export interface AgentSpawnOptions {
  agentId: string;
  reqNumber: string;
  featureTitle: string;
  contextData: any;
  timeoutMs?: number;
}

export interface AgentDeliverable {
  req_number: string;
  agent: string;
  status: 'COMPLETE' | 'BLOCKED' | 'FAILED';
  timestamp: string;
  [key: string]: any;
}

export class AgentSpawnerService {
  private nc!: NatsConnection;

  async initialize(): Promise<void> {
    this.nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });
    console.log('[AgentSpawner] Connected to NATS');
  }

  /**
   * Spawn an agent and wait for completion
   */
  async spawnAgent(options: AgentSpawnOptions): Promise<AgentDeliverable> {
    const { agentId, reqNumber, featureTitle, contextData, timeoutMs = 7200000 } = options;

    console.log(`[AgentSpawner] Spawning ${agentId} for ${reqNumber}`);

    // 1. Build agent prompt with context
    const prompt = this.buildPrompt(agentId, reqNumber, featureTitle, contextData);

    // 2. Get agent file path
    const agentFilePath = this.getAgentFilePath(agentId);

    if (!fs.existsSync(agentFilePath)) {
      throw new Error(`Agent file not found: ${agentFilePath}`);
    }

    // 3. Spawn agent as Claude Code subprocess
    const agentProcess = this.spawnAgentProcess(agentFilePath, prompt);

    // 4. Subscribe to NATS for deliverable
    const deliverableSubject = `wms.features.${this.getAgentStream(agentId)}.${reqNumber}`;
    console.log(`[AgentSpawner] Subscribing to: ${deliverableSubject}`);

    // 5. Wait for completion or timeout
    try {
      const deliverable = await this.waitForCompletion(
        deliverableSubject,
        agentProcess,
        timeoutMs
      );

      console.log(`[AgentSpawner] ${agentId} completed for ${reqNumber}`);
      return deliverable;
    } catch (error) {
      agentProcess.kill('SIGTERM');
      throw error;
    }
  }

  /**
   * Build prompt with context for agent
   */
  private buildPrompt(
    agentId: string,
    reqNumber: string,
    featureTitle: string,
    contextData: any
  ): string {
    const agentName = this.getAgentName(agentId);
    const stream = this.getAgentStream(agentId);

    let prompt = `
You are ${agentName}.

TASK: ${reqNumber} - ${featureTitle}
`.trim();

    // Add context from previous stages
    if (contextData.previousStages && contextData.previousStages.length > 0) {
      prompt += `\n\nPREVIOUS STAGE DELIVERABLES:`;
      for (const stage of contextData.previousStages) {
        prompt += `\n- ${stage.stage} (${stage.agent}): ${stage.deliverableUrl}`;
      }
      prompt += `\n\nRetrieve these deliverables from NATS before starting your work.`;
    }

    // Add specific context
    if (contextData.requirements) {
      prompt += `\n\nREQUIREMENTS:\n${contextData.requirements}`;
    }

    if (contextData.specifications) {
      prompt += `\n\nSPECIFICATIONS:\n${JSON.stringify(contextData.specifications, null, 2)}`;
    }

    // Add deliverable instructions
    prompt += `\n\nDELIVERABLE INSTRUCTIONS:
1. Complete your work according to your agent definition
2. Publish your FULL deliverable to NATS stream: wms.features.${stream}.${reqNumber}
3. Return a tiny completion notice (< 1000 tokens) when done

The completion notice should be JSON format:
{
  "agent": "${agentId}",
  "req_number": "${reqNumber}",
  "status": "COMPLETE" | "BLOCKED" | "FAILED",
  "deliverable": "nats://wms.features.${stream}.${reqNumber}",
  "summary": "Brief summary of what you completed",
  "next_agent": "name-of-next-agent" (or null if workflow complete)
}

If you encounter blockers, set status to "BLOCKED" and explain in summary.
`;

    return prompt;
  }

  /**
   * Spawn Claude Code agent process
   */
  private spawnAgentProcess(agentFilePath: string, prompt: string): ChildProcess {
    // Use Claude Code CLI to spawn agent
    // Adjust path to claude executable as needed
    const claudeCommand = process.env.CLAUDE_CLI_PATH || 'claude';

    const args = [
      'task',
      '--agent', agentFilePath,
      '--prompt', prompt,
    ];

    console.log(`[AgentSpawner] Executing: ${claudeCommand} ${args.slice(0, 2).join(' ')}`);

    const process = spawn(claudeCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Pass through necessary environment variables
      },
    });

    // Log stdout
    process.stdout?.on('data', (data) => {
      console.log(`[Agent Output] ${data.toString().trim()}`);
    });

    // Log stderr
    process.stderr?.on('data', (data) => {
      console.error(`[Agent Error] ${data.toString().trim()}`);
    });

    return process;
  }

  /**
   * Wait for agent to publish deliverable to NATS
   */
  private async waitForCompletion(
    subject: string,
    process: ChildProcess,
    timeoutMs: number
  ): Promise<AgentDeliverable> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Agent timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      let processExited = false;

      // Subscribe to NATS for deliverable
      (async () => {
        const sub = this.nc.subscribe(subject);

        for await (const msg of sub) {
          try {
            const deliverable = JSON.parse(msg.string());
            clearTimeout(timeout);
            sub.unsubscribe();

            // Verify deliverable format
            if (!deliverable.req_number || !deliverable.agent || !deliverable.status) {
              reject(new Error('Invalid deliverable format'));
              return;
            }

            resolve(deliverable);
            break;
          } catch (error) {
            console.error('[AgentSpawner] Failed to parse deliverable:', error);
          }
        }
      })();

      // Handle process exit
      process.on('exit', (code) => {
        processExited = true;
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Agent process exited with code ${code}`));
        }
      });

      // Handle process error
      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Agent process error: ${error.message}`));
      });
    });
  }

  /**
   * Get agent file path
   */
  private getAgentFilePath(agentId: string): string {
    const agentFileName = `${agentId}.md`;
    return path.join(process.cwd(), '.claude', 'agents', agentFileName);
  }

  /**
   * Get agent name from ID
   */
  private getAgentName(agentId: string): string {
    const nameMap: Record<string, string> = {
      'cynthia': 'Cynthia (Research Specialist)',
      'sylvia': 'Sylvia (Critique Specialist)',
      'roy': 'Roy (Backend Developer)',
      'jen': 'Jen (Frontend Developer)',
      'billy': 'Billy (QA Engineer)',
      'priya': 'Priya (Statistics Analyst)',
    };
    return nameMap[agentId] || agentId;
  }

  /**
   * Get NATS stream name from agent ID
   */
  private getAgentStream(agentId: string): string {
    const streamMap: Record<string, string> = {
      'cynthia': 'research',
      'sylvia': 'critique',
      'roy': 'backend',
      'jen': 'frontend',
      'billy': 'qa',
      'priya': 'statistics',
    };
    return streamMap[agentId] || agentId;
  }

  async close(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
    }
  }
}
