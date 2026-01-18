/**
 * Cleanup Duplicate Requests Script
 *
 * This script identifies and removes duplicate requests from the SDLC database.
 * It keeps one copy of each unique title (the one with the longest valid description)
 * and deletes duplicates with {} or truncated descriptions.
 *
 * Run: npx tsx scripts/cleanup-duplicate-requests.ts
 *
 * Options:
 *   --dry-run    Preview only, don't delete (default)
 *   --execute    Actually delete the duplicates
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

// Descriptions that are considered "bad" and should be replaced
function isBadDescription(desc: string | null): boolean {
  if (!desc) return true;
  if (desc === '{}') return true;
  if (desc === '[]') return true;
  if (desc.startsWith('{') && !desc.includes(':')) return true; // Truncated JSON
  if (desc.startsWith('{\n') && desc.length < 50) return true; // Truncated JSON
  if (desc === '[Request interrupted by user]') return true;
  if (desc.trim().length < 10) return true; // Too short to be useful
  return false;
}

// Score a description - higher is better
function scoreDescription(desc: string | null): number {
  if (!desc) return 0;
  if (isBadDescription(desc)) return 0;

  let score = desc.length;

  // Bonus for structured content
  if (desc.includes('**Requirements:**')) score += 100;
  if (desc.includes('## ')) score += 50;
  if (desc.includes('- ')) score += 25;

  return score;
}

async function fetchAllRequests(): Promise<Request[]> {
  console.log(`Fetching requests from ${API_BASE}/requests...`);

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

async function deleteRequest(reqNumber: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/requests/${reqNumber}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': 'cleanup-script',
    },
  });

  const data = await response.json();
  return data.success;
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
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  console.log('='.repeat(70));
  console.log('SDLC Request Duplicate Cleanup Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'EXECUTE (will delete)'}`);
  console.log('');

  // Fetch all requests
  const requests = await fetchAllRequests();
  console.log(`Total requests: ${requests.length}`);
  console.log('');

  // Group by title
  const groups = groupByTitle(requests);

  // Find duplicates
  const toDelete: Request[] = [];
  const toKeep: Request[] = [];

  let duplicateGroups = 0;

  for (const [title, group] of groups) {
    if (group.length === 1) {
      // No duplicates for this title
      continue;
    }

    duplicateGroups++;

    // Sort by description score (best first)
    group.sort((a, b) => scoreDescription(b.description) - scoreDescription(a.description));

    // Keep the best one
    const best = group[0];
    toKeep.push(best);

    // Mark the rest for deletion
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i]);
    }
  }

  // Also find requests with bad descriptions that aren't duplicates
  const badDescriptionRequests: Request[] = [];
  for (const req of requests) {
    if (isBadDescription(req.description) && !toDelete.includes(req)) {
      // Check if this is the only one with this title
      const group = groups.get(req.title)!;
      if (group.length === 1) {
        badDescriptionRequests.push(req);
      }
    }
  }

  // Print summary
  console.log('='.repeat(70));
  console.log('DUPLICATE ANALYSIS');
  console.log('='.repeat(70));
  console.log(`Found ${duplicateGroups} titles with duplicates`);
  console.log(`Requests to DELETE: ${toDelete.length}`);
  console.log(`Requests to KEEP (best of each group): ${toKeep.length}`);
  console.log(`Single requests with bad descriptions: ${badDescriptionRequests.length}`);
  console.log('');

  // Print duplicate groups
  console.log('='.repeat(70));
  console.log('DUPLICATES TO DELETE (grouped by title)');
  console.log('='.repeat(70));

  const deleteByTitle = new Map<string, Request[]>();
  for (const req of toDelete) {
    const existing = deleteByTitle.get(req.title) || [];
    existing.push(req);
    deleteByTitle.set(req.title, existing);
  }

  for (const [title, reqs] of Array.from(deleteByTitle.entries()).sort((a, b) => b[1].length - a[1].length)) {
    const kept = toKeep.find(r => r.title === title)!;
    console.log('');
    console.log(`Title: "${title}" (${reqs.length} duplicates to delete)`);
    console.log(`  KEEP: ${kept.reqNumber}`);
    console.log(`    Description: ${kept.description?.substring(0, 80)}${(kept.description?.length || 0) > 80 ? '...' : ''}`);
    console.log(`  DELETE:`);
    for (const req of reqs) {
      const descPreview = req.description?.substring(0, 50) || '(null)';
      console.log(`    - ${req.reqNumber}: "${descPreview}${(req.description?.length || 0) > 50 ? '...' : ''}"`);
    }
  }

  // Print bad description requests (not duplicates)
  if (badDescriptionRequests.length > 0) {
    console.log('');
    console.log('='.repeat(70));
    console.log('SINGLE REQUESTS WITH BAD DESCRIPTIONS (not deleting, but flagged)');
    console.log('='.repeat(70));
    for (const req of badDescriptionRequests.slice(0, 20)) {
      console.log(`  ${req.reqNumber}: "${req.title}"`);
      console.log(`    Description: "${req.description}"`);
    }
    if (badDescriptionRequests.length > 20) {
      console.log(`  ... and ${badDescriptionRequests.length - 20} more`);
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Will delete ${toDelete.length} duplicate requests`);
  console.log(`Will keep ${toKeep.length} requests (best of each duplicate group)`);
  console.log(`${badDescriptionRequests.length} single requests have bad descriptions (not deleting)`);
  console.log('');

  if (dryRun) {
    console.log('This was a DRY RUN. No changes were made.');
    console.log('To actually delete, run with --execute flag:');
    console.log('  npx tsx scripts/cleanup-duplicate-requests.ts --execute');
    return;
  }

  // Execute deletions
  console.log('EXECUTING DELETIONS...');
  console.log('');

  let deleted = 0;
  let failed = 0;

  for (const req of toDelete) {
    process.stdout.write(`Deleting ${req.reqNumber}... `);
    const success = await deleteRequest(req.reqNumber);
    if (success) {
      console.log('OK');
      deleted++;
    } else {
      console.log('FAILED');
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('DELETION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Successfully deleted: ${deleted}`);
  console.log(`Failed to delete: ${failed}`);
}

main().catch(console.error);
