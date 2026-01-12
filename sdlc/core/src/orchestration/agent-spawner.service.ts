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
    // Use docker-compose port mapping (4223) by default
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4223';

    const connectionOptions: any = {
      servers: natsUrl,
      name: 'agogsaas-agent-spawner',
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1000,
    };

    // If credentials are not in URL, check for separate env vars
    if (!natsUrl.includes('@')) {
      const user = process.env.NATS_USER;
      const pass = process.env.NATS_PASSWORD;
      if (user && pass) {
        connectionOptions.user = user;
        connectionOptions.pass = pass;
        console.log(`[AgentSpawner] Using credentials for user: ${user}`);
      }
    }

    this.nc = await connect(connectionOptions);
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

    // 4. Subscribe to NATS for deliverable (using deliverables pattern)
    const deliverableSubject = `agog.deliverables.${agentId}.${this.getAgentStream(agentId)}.${reqNumber}`;
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

    // Add specific context (only if minimal - avoid token burn)
    if (contextData.requirements && contextData.requirements.length < 500) {
      prompt += `\n\nREQUIREMENTS:\n${contextData.requirements}`;
    }

    if (contextData.specifications && JSON.stringify(contextData.specifications).length < 500) {
      prompt += `\n\nSPECIFICATIONS:\n${JSON.stringify(contextData.specifications, null, 2)}`;
    }

    // TOKEN BURN PREVENTION: Don't include Sylvia's critique inline!
    // Roy/Jen should fetch it from NATS using the previousStages URLs above
    // This saves ~5K-10K tokens per spawn (95% reduction)

    // Add deliverable instructions
    prompt += `\n\nDELIVERABLE INSTRUCTIONS:
1. Complete your work according to your agent definition
2. Publish your FULL deliverable to NATS using the pattern: agog.deliverables.${agentId}.${stream}.${reqNumber}
3. Return a tiny completion notice (< 1000 tokens) when done

AGENT OUTPUT DIRECTORY:
- You have write access to: $AGENT_OUTPUT_DIR (environment variable)
- Use $AGENT_OUTPUT_DIR/nats-scripts/ for NATS publishing scripts
- Use $AGENT_OUTPUT_DIR/deliverables/ for full deliverable documents
- Example: Write to "$AGENT_OUTPUT_DIR/nats-scripts/publish-${reqNumber}.ts"

The completion notice should be JSON format:
{
  "agent": "${agentId}",
  "req_number": "${reqNumber}",
  "status": "COMPLETE" | "BLOCKED" | "FAILED",
  "deliverable": "nats://agog.deliverables.${agentId}.${stream}.${reqNumber}",
  "summary": "Brief summary of what you completed",
  "next_agent": "name-of-next-agent" (or null if workflow complete)
}

IMPORTANT: Set status to "COMPLETE" if your work is done, even if NATS publishing fails. Only use "BLOCKED" for actual business/technical blockers that prevent you from completing your analysis or implementation.
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
      '--agent', agentFilePath,
      '--print',  // Non-interactive mode
      '--no-session-persistence',  // Don't save sessions
    ];

    console.log(`[AgentSpawner] Executing: ${claudeCommand} --agent ${path.basename(agentFilePath)} --print`);
    console.log(`[AgentSpawner] Prompt length: ${prompt.length} chars`);

    const agentProcess = spawn(claudeCommand, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true, // Required for Windows to find .cmd files in PATH
      env: {
        ...process.env,
        // Pass agent output directory for file writes
        AGENT_OUTPUT_DIR: path.join(process.cwd(), 'agent-output'),
        // Ensure NATS URL is available
        NATS_URL: process.env.NATS_URL || 'nats://localhost:4223',
      },
    });

    // Write prompt to stdin
    if (agentProcess.stdin) {
      agentProcess.stdin.write(prompt);
      agentProcess.stdin.end();
    }

    // Note: stdout is collected in waitForCompletion() to parse JSON
    // We log stderr for debugging
    agentProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[Agent Error] ${data.toString().trim()}`);
    });

    return agentProcess;
  }

  /**
   * Wait for agent to complete and parse output
   */
  private async waitForCompletion(
    subject: string,
    agentProcess: ChildProcess,
    timeoutMs: number
  ): Promise<AgentDeliverable> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        agentProcess.kill('SIGTERM');
        reject(new Error(`Agent timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      let stdoutBuffer = '';

      // Collect stdout to parse JSON completion notice (and log it)
      agentProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdoutBuffer += chunk;
        console.log(`[Agent Output] ${chunk.trim()}`);
      });

      // Handle process exit - parse stdout for JSON
      agentProcess.on('exit', (code) => {
        clearTimeout(timeout);

        // Extract JSON from stdout - handle markdown code blocks
        // First try to extract from ```json ... ``` blocks
        let jsonText = '';
        const codeBlockMatch = stdoutBuffer.match(/```json\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        } else {
          // Fallback: look for {...} pattern with agent/status fields
          const jsonMatch = stdoutBuffer.match(/\{[\s\S]*?"agent"[\s\S]*?"status"[\s\S]*?\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }

        if (jsonText) {
          try {
            const deliverable = JSON.parse(jsonText);

            // Verify deliverable format
            if (!deliverable.req_number || !deliverable.agent || !deliverable.status) {
              reject(new Error('Invalid deliverable format in stdout'));
              return;
            }

            console.log(`[AgentSpawner] Parsed completion notice from stdout: ${deliverable.status}`);
            resolve(deliverable);
            return;
          } catch (error) {
            console.error('[AgentSpawner] Failed to parse JSON from stdout:', error);
          }
        }

        // If no JSON found or parsing failed, reject
        if (code !== 0 && code !== null) {
          reject(new Error(`Agent process exited with code ${code}`));
        } else {
          reject(new Error('Agent completed but no valid JSON completion notice found'));
        }
      });

      // Handle process error
      agentProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Agent process error: ${error.message}`));
      });
    });
  }

  /**
   * Get agent file path
   */
  private getAgentFilePath(agentId: string): string {
    // Agents are mounted at /app/agents/personas in Docker container
    // Use SDLC_AGENTS_DIR env var or default to agents/personas relative to cwd
    const agentsDir = process.env.SDLC_AGENTS_DIR || path.join(process.cwd(), 'agents', 'personas');

    // Agent files follow pattern: agentId-*.md (e.g., cynthia-research.md)
    const matches = fs.readdirSync(agentsDir).filter(f =>
      f.startsWith(`${agentId}-`) && f.endsWith('.md')
    );

    if (matches.length === 0) {
      throw new Error(`Agent file not found for ${agentId} in ${agentsDir}`);
    }

    return path.join(agentsDir, matches[0]);
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
