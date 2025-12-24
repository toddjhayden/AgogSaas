  /**
   * Monitor IN_PROGRESS workflows and spawn next agents when stages complete
   * This is the MISSING LOGIC that makes workflows actually progress
   */
  private async progressInProgressWorkflows(): Promise<void> {
    if (!fs.existsSync(this.ownerRequestsPath)) {
      return;
    }

    const content = fs.readFileSync(this.ownerRequestsPath, 'utf-8');
    const requestPattern = /###\s+(REQ-[A-Z-]+-\d+):[^\n]*\n+\*\*Status\*\*:\s*IN_PROGRESS/g;
    let match;

    while ((match = requestPattern.exec(content)) !== null) {
      const reqNumber = match[1];

      try {
        // Check which stage this workflow is at
        const currentStage = await this.detectCurrentStage(reqNumber);

        if (currentStage === null) {
          // No deliverables yet - workflow just started, skip
          continue;
        }

        if (currentStage === 6) {
          // All 6 stages complete - this will be handled by workflow completion event
          continue;
        }

        // Check if we already spawned the next agent
        const nextStage = currentStage + 1;
        const workflow = await this.orchestrator.getWorkflowStatus(reqNumber);

        if (!workflow) {
          console.log(`[StrategicOrchestrator] ${reqNumber} at stage ${currentStage}, spawning next stage ${nextStage}`);

          // Extract title
          const { title, assignedTo } = this.extractRequestDetails(content, reqNumber);

          // Resume from next stage
          await this.orchestrator.resumeWorkflowFromStage(reqNumber, title, assignedTo, nextStage);
          console.log(`[StrategicOrchestrator] ✅ Progressed ${reqNumber} to stage ${nextStage + 1}`);
        }

      } catch (error: any) {
        console.error(`[StrategicOrchestrator] Error progressing ${reqNumber}:`, error.message);
      }
    }
  }

  /**
   * Detect which stage a workflow has completed
   * Returns 0-6 (0=no deliverables, 6=all complete)
   */
  private async detectCurrentStage(reqNumber: string): Promise<number | null> {
    const stages = [
      { agent: 'cynthia', stream: 'research' },
      { agent: 'sylvia', stream: 'critique' },
      { agent: 'roy', stream: 'backend' },
      { agent: 'jen', stream: 'frontend' },
      { agent: 'billy', stream: 'qa' },
      { agent: 'priya', stream: 'statistics' },
    ];

    let lastCompletedStage = -1;

    for (let i = 0; i < stages.length; i++) {
      const { agent, stream } = stages[i];
      const subject = `agog.deliverables.${agent}.${stream}.${reqNumber}`;

      try {
        const jsm = await this.nc.jetstreamManager();
        const streamName = `agog_features_${stream}`;
        await jsm.streams.getMessage(streamName, { last_by_subj: subject });
        lastCompletedStage = i;
      } catch (error) {
        // Deliverable not found - stop here
        break;
      }
    }

    return lastCompletedStage === -1 ? null : lastCompletedStage + 1;
  }
