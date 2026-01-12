/**
 * Start All Services
 * Launches proactive daemons with proper environment configuration
 */

// Set environment variables for local development
// Load from .env file or use defaults
// IMPORTANT: Set NATS_PASSWORD environment variable before running
if (!process.env.NATS_URL) process.env.NATS_URL = 'nats://localhost:4223';
if (!process.env.NATS_USER) process.env.NATS_USER = 'agents';
if (!process.env.OWNER_REQUESTS_PATH) {
  process.env.OWNER_REQUESTS_PATH = 'D:/GitHub/agogsaas/project-spirit/owner_requests/OWNER_REQUESTS.md';
}

// Import and run the main daemon starter
import('./start-proactive-daemons');
