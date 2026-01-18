/**
 * Cleanup Duplicate Requests - SQL Generator
 *
 * This script generates SQL DELETE statements to remove duplicate requests.
 * Run the output SQL on the VPS PostgreSQL database.
 *
 * Run: npx tsx scripts/cleanup-duplicate-requests-sql.ts > cleanup.sql
 */

const API_BASE = process.env.SDLC_API_URL || 'https://api.agog.fyi/api/agent';

interface Request {
  id: string;
  reqNumber: string;
  title: string;
  description: string | null;
  currentPhase: string;
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    requests: Request[];
  };
  error?: string;
}

function isBadDescription(desc: string | null): boolean {
  if (!desc) return true;
  if (desc === '{}') return true;
  if (desc === '[]') return true;
  if (desc.startsWith('{') && !desc.includes(':')) return true;
  if (desc.startsWith('{\n') && desc.length < 50) return true;
  if (desc === '[Request interrupted by user]') return true;
  if (desc.trim().length < 10) return true;
  return false;
}

function scoreDescription(desc: string | null): number {
  if (!desc) return 0;
  if (isBadDescription(desc)) return 0;
  let score = desc.length;
  if (desc.includes('**Requirements:**')) score += 100;
  if (desc.includes('## ')) score += 50;
  if (desc.includes('- ')) score += 25;
  return score;
}

async function fetchAllRequests(): Promise<Request[]> {
  console.error(`Fetching requests from ${API_BASE}/requests...`);
  const response = await fetch(`${API_BASE}/requests`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': 'cleanup-script',
    },
  });
  const data: ApiResponse = await response.json();
  if (!data.success || !data.data?.requests) {
    throw new Error(`Failed to fetch requests: ${data.error || 'Unknown error'}`);
  }
  return data.data.requests;
}

function groupByTitle(requests: Request[]): Map<string, Request[]> {
  const groups = new Map<string, Request[]>();
  for (const req of requests) {
    const existing = groups.get(req.title) || [];
    existing.push(req);
    groups.set(req.title, existing);
  }
  return groups;
}

async function main() {
  const requests = await fetchAllRequests();
  console.error(`Total requests: ${requests.length}`);

  const groups = groupByTitle(requests);
  const toDelete: Request[] = [];

  for (const [title, group] of groups) {
    if (group.length === 1) continue;
    group.sort((a, b) => scoreDescription(b.description) - scoreDescription(a.description));
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i]);
    }
  }

  console.error(`Found ${toDelete.length} duplicates to delete`);
  console.error('');

  // Output SQL
  console.log('-- SDLC Duplicate Request Cleanup');
  console.log('-- Generated: ' + new Date().toISOString());
  console.log(`-- Total duplicates to delete: ${toDelete.length}`);
  console.log('');
  console.log('BEGIN;');
  console.log('');

  for (const req of toDelete) {
    const escapedTitle = req.title.replace(/'/g, "''");
    console.log(`-- Title: "${req.title}"`);
    console.log(`-- Description: ${req.description?.substring(0, 50) || '(null)'}...`);
    console.log(`DELETE FROM owner_requests WHERE req_number = '${req.reqNumber}';`);
    console.log('');
  }

  console.log('-- Verify before committing:');
  console.log('-- SELECT COUNT(*) FROM owner_requests;');
  console.log('');
  console.log('COMMIT;');
  console.log('');
  console.log('-- To rollback instead: ROLLBACK;');
}

main().catch(console.error);
