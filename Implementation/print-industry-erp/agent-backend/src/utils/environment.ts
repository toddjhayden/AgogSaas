/**
 * Environment Detection Utilities
 * Provides functions to detect runtime environment (Docker vs Host)
 * Used by daemons to avoid Windows-specific operations in Docker
 */

import * as fs from 'fs';

/**
 * Check if running inside Docker container
 * Uses multiple detection methods for reliability
 */
export function isRunningInDocker(): boolean {
  // Method 1: Check for /.dockerenv file (most reliable)
  if (fs.existsSync('/.dockerenv')) {
    return true;
  }

  // Method 2: Check cgroup (Linux containers)
  try {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
    if (cgroup.includes('docker') || cgroup.includes('kubepods')) {
      return true;
    }
  } catch {
    // File doesn't exist on non-Linux or non-containerized systems
  }

  // Method 3: Check for DOCKER_CONTAINER env var (set in docker-compose)
  if (process.env.DOCKER_CONTAINER === 'true') {
    return true;
  }

  // Method 4: Check hostname pattern (docker generates random hostnames)
  const hostname = require('os').hostname();
  if (/^[a-f0-9]{12}$/.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * Check if Windows-specific features are available
 * Returns false if running in Docker (Linux container)
 */
export function canUseWindowsFeatures(): boolean {
  // Docker containers are Linux - can't use Windows features
  if (isRunningInDocker()) {
    return false;
  }

  // Check if actually on Windows
  return process.platform === 'win32';
}

/**
 * Check if Claude CLI is available
 * Returns false if running in Docker (Claude CLI not installed in container)
 */
export function canSpawnClaudeAgents(): boolean {
  // Docker containers don't have Claude CLI installed
  if (isRunningInDocker()) {
    return false;
  }

  // Check if claude command exists
  try {
    const { execSync } = require('child_process');
    execSync('claude --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker CLI is available (for docker commands from inside container)
 * Requires docker socket mount
 */
export function canUseDockerCLI(): boolean {
  // Check if docker socket is mounted
  if (fs.existsSync('/var/run/docker.sock')) {
    return true;
  }

  // Check if docker command works
  try {
    const { execSync } = require('child_process');
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Log environment info at startup
 */
export function logEnvironmentInfo(serviceName: string): void {
  const inDocker = isRunningInDocker();
  const canWindows = canUseWindowsFeatures();
  const canClaude = canSpawnClaudeAgents();
  const canDocker = canUseDockerCLI();

  console.log(`[${serviceName}] Environment:`);
  console.log(`[${serviceName}]   - Running in Docker: ${inDocker}`);
  console.log(`[${serviceName}]   - Windows features: ${canWindows}`);
  console.log(`[${serviceName}]   - Claude CLI available: ${canClaude}`);
  console.log(`[${serviceName}]   - Docker CLI available: ${canDocker}`);
}
