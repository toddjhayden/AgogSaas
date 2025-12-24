/**
 * Git Branch Manager
 * Implements git branch isolation for concurrent workflows
 * Prevents merge conflicts and race conditions
 */

import { execSync } from 'child_process';

export interface BranchInfo {
  reqNumber: string;
  branchName: string;
  createdAt: Date;
  status: 'active' | 'merged' | 'conflict';
}

export class GitBranchManager {
  private activeBranches: Map<string, BranchInfo> = new Map();
  private repoPath: string;

  constructor(repoPath: string = '/workspace/app-backend') {
    this.repoPath = repoPath;
  }

  /**
   * Create feature branch for workflow
   */
  async createBranch(reqNumber: string): Promise<string> {
    const branchName = `feature/${reqNumber}`;

    try {
      // Ensure we're on master and up to date
      execSync('git checkout master', { cwd: this.repoPath });
      execSync('git pull origin master', { cwd: this.repoPath });

      // Create and checkout feature branch
      execSync(`git checkout -b ${branchName}`, { cwd: this.repoPath });

      this.activeBranches.set(reqNumber, {
        reqNumber,
        branchName,
        createdAt: new Date(),
        status: 'active'
      });

      console.log(`[GitBranchManager] Created branch: ${branchName}`);
      return branchName;
    } catch (error: any) {
      console.error(`[GitBranchManager] Failed to create branch ${branchName}:`, error.message);
      throw error;
    }
  }

  /**
   * Commit changes to feature branch
   */
  async commit(reqNumber: string, message: string, agent: string): Promise<void> {
    const branch = this.activeBranches.get(reqNumber);
    if (!branch) {
      throw new Error(`No active branch for ${reqNumber}`);
    }

    try {
      execSync('git add .', { cwd: this.repoPath });
      execSync(`git commit -m "${message}\n\nAgent: ${agent}\nReq: ${reqNumber}"`, { cwd: this.repoPath });
      console.log(`[GitBranchManager] Committed to ${branch.branchName}: ${message}`);
    } catch (error: any) {
      // Ignore "nothing to commit" errors
      if (!error.message.includes('nothing to commit')) {
        console.error(`[GitBranchManager] Commit failed:`, error.message);
        throw error;
      }
    }
  }

  /**
   * Merge feature branch to master
   */
  async mergeBranch(reqNumber: string): Promise<void> {
    const branch = this.activeBranches.get(reqNumber);
    if (!branch) {
      throw new Error(`No active branch for ${reqNumber}`);
    }

    try {
      // Switch to master
      execSync('git checkout master', { cwd: this.repoPath });

      // Pull latest
      execSync('git pull origin master', { cwd: this.repoPath });

      // Attempt merge
      try {
        execSync(`git merge --no-ff ${branch.branchName} -m "Merge ${reqNumber}: ${branch.branchName}"`, { cwd: this.repoPath });

        branch.status = 'merged';
        console.log(`[GitBranchManager] ✅ Merged ${branch.branchName} to master`);

        // Delete feature branch
        await this.deleteBranch(reqNumber);

      } catch (mergeError: any) {
        // Merge conflict detected
        if (mergeError.message.includes('CONFLICT')) {
          branch.status = 'conflict';
          console.error(`[GitBranchManager] ❌ Merge conflict in ${branch.branchName}`);

          // Abort merge
          execSync('git merge --abort', { cwd: this.repoPath });

          // Try rebase instead
          await this.rebaseBranch(reqNumber);
        } else {
          throw mergeError;
        }
      }
    } catch (error: any) {
      console.error(`[GitBranchManager] Merge failed for ${branch.branchName}:`, error.message);
      throw error;
    }
  }

  /**
   * Rebase feature branch on master
   */
  private async rebaseBranch(reqNumber: string): Promise<void> {
    const branch = this.activeBranches.get(reqNumber);
    if (!branch) {
      throw new Error(`No active branch for ${reqNumber}`);
    }

    try {
      // Checkout feature branch
      execSync(`git checkout ${branch.branchName}`, { cwd: this.repoPath });

      // Rebase on master
      execSync('git rebase master', { cwd: this.repoPath });

      console.log(`[GitBranchManager] ✅ Rebased ${branch.branchName} on master`);

      // Try merge again
      execSync('git checkout master', { cwd: this.repoPath });
      execSync(`git merge --no-ff ${branch.branchName}`, { cwd: this.repoPath });

      branch.status = 'merged';
      console.log(`[GitBranchManager] ✅ Merged ${branch.branchName} after rebase`);

      await this.deleteBranch(reqNumber);

    } catch (error: any) {
      // If rebase fails, escalate to human
      branch.status = 'conflict';
      console.error(`[GitBranchManager] ❌ Rebase failed for ${branch.branchName} - needs human intervention`);
      throw new Error(`Merge conflict in ${branch.branchName} - cannot auto-resolve`);
    }
  }

  /**
   * Delete feature branch
   */
  async deleteBranch(reqNumber: string): Promise<void> {
    const branch = this.activeBranches.get(reqNumber);
    if (!branch) {
      return;
    }

    try {
      execSync(`git branch -d ${branch.branchName}`, { cwd: this.repoPath });
      this.activeBranches.delete(reqNumber);
      console.log(`[GitBranchManager] Deleted branch: ${branch.branchName}`);
    } catch (error: any) {
      console.error(`[GitBranchManager] Failed to delete branch ${branch.branchName}:`, error.message);
    }
  }

  /**
   * Get active branches
   */
  getActiveBranches(): BranchInfo[] {
    return Array.from(this.activeBranches.values());
  }

  /**
   * Check if workflow can start (concurrency limit)
   */
  canStartWorkflow(maxConcurrent: number = 4): boolean {
    const activeCount = Array.from(this.activeBranches.values())
      .filter(b => b.status === 'active')
      .length;

    return activeCount < maxConcurrent;
  }
}
