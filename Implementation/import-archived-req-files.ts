#!/usr/bin/env ts-node
/**
 * Import Archived REQ Files to Database
 *
 * This script imports all archived REQ files into the agent_memory database
 * using the correct schema (agent_id instead of agent_name)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

// Database configuration
const DB_CONFIG = {
  host: 'localhost',
  port: 5434,
  database: 'agent_memory',
  user: 'agent_user',
  password: 'agent_dev_password_2024',
};

const ARCHIVE_BASE = 'D:/GitHub/agogsaas/Implementation/.archive/orphaned-deliverables';

interface ReqFile {
  path: string;
  filename: string;
  content: string;
  agentId: string;
  reqNumber: string;
  timestamp: Date;
  type: 'deliverable' | 'research' | 'critique' | 'qa' | 'completion' | 'other';
}

interface ImportStats {
  totalFound: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const stats: ImportStats = {
  totalFound: 0,
  imported: 0,
  skipped: 0,
  errors: [],
};

/**
 * Recursively find all archived REQ files
 */
function findArchivedReqFiles(dir: string): string[] {
  const results: string[] = [];

  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...findArchivedReqFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error);
  }

  return results;
}

/**
 * Parse REQ file to extract metadata
 */
function parseReqFile(filePath: string): ReqFile | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);

    // Extract agent ID from directory structure or filename
    const pathParts = filePath.split(path.sep);
    const archiveIdx = pathParts.indexOf('orphaned-deliverables');
    let agentId = 'UNKNOWN';

    if (archiveIdx >= 0 && pathParts.length > archiveIdx + 1) {
      agentId = pathParts[archiveIdx + 1].toLowerCase();
    }

    // Try to extract from filename as well
    const agentPatterns = [
      /^([A-Z]+)_/,  // CYNTHIA_REQ-...
      /_([A-Z]+)_/,  // REQ-..._CYNTHIA_...
      /^([a-z]+)-/,  // cynthia-research-...
    ];

    for (const pattern of agentPatterns) {
      const match = filename.match(pattern);
      if (match) {
        agentId = match[1].toLowerCase();
        break;
      }
    }

    // Map common agent names
    const agentMapping: Record<string, string> = {
      'cynthia': 'cynthia-research',
      'sylvia': 'sylvia-critique',
      'roy': 'roy-backend',
      'jen': 'jen-frontend',
      'billy': 'billy-qa',
      'priya': 'priya-statistics',
      'berry': 'berry-devops',
      'marcus': 'marcus-implementation',
    };

    if (agentMapping[agentId]) {
      agentId = agentMapping[agentId];
    }

    // Extract REQ number
    let reqNumber = 'UNKNOWN';
    const reqPatterns = [
      /REQ-([A-Z-]+\d+)/i,  // REQ-INFRA-DASHBOARD-001
      /REQ-STRATEGIC-AUTO-(\d+)/,  // REQ-STRATEGIC-AUTO-1766436689295
    ];

    for (const pattern of reqPatterns) {
      const match = filename.match(pattern);
      if (match) {
        reqNumber = match[1];
        break;
      }
    }

    // Extract timestamp from filename or directory
    let timestamp = new Date();
    const timestampMatch = filename.match(/(\d{13})/);
    if (timestampMatch) {
      timestamp = new Date(parseInt(timestampMatch[1]));
    } else {
      // Try to get from directory date (YYYY-MM-DD)
      const dateMatch = filePath.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        timestamp = new Date(dateMatch[0]);
      } else {
        const fileStat = fs.statSync(filePath);
        timestamp = fileStat.mtime;
      }
    }

    // Determine type
    let type: ReqFile['type'] = 'other';
    if (filename.includes('DELIVERABLE') || filename.includes('deliverable')) type = 'deliverable';
    else if (filename.includes('RESEARCH') || filename.includes('research')) type = 'research';
    else if (filename.includes('CRITIQUE') || filename.includes('critique')) type = 'critique';
    else if (filename.includes('QA') || filename.includes('qa')) type = 'qa';
    else if (filename.includes('COMPLETION') || filename.includes('completion')) type = 'completion';

    return {
      path: filePath,
      filename,
      content,
      agentId,
      reqNumber,
      timestamp,
      type,
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    stats.errors.push(`Error parsing ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Import REQ file to database
 */
async function importToDatabase(client: Client, reqFile: ReqFile): Promise<boolean> {
  try {
    // Create a memory record using correct schema
    const query = `
      INSERT INTO public.memories (
        agent_id,
        memory_type,
        content,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    const metadata = {
      req_number: reqFile.reqNumber,
      filename: reqFile.filename,
      original_path: reqFile.path,
      type: reqFile.type,
      imported_at: new Date().toISOString(),
      source: 'archived_deliverable',
    };

    const result = await client.query(query, [
      reqFile.agentId,
      reqFile.type,
      reqFile.content,
      JSON.stringify(metadata),
      reqFile.timestamp,
    ]);

    if (result.rowCount && result.rowCount > 0) {
      console.log(`✓ Imported: ${reqFile.filename} (Agent: ${reqFile.agentId}, REQ: ${reqFile.reqNumber})`);
      return true;
    } else {
      console.log(`⊘ Skipped (duplicate): ${reqFile.filename}`);
      stats.skipped++;
      return false;
    }
  } catch (error) {
    console.error(`✗ Error importing ${reqFile.filename}:`, error);
    stats.errors.push(`Error importing ${reqFile.filename}: ${error}`);
    return false;
  }
}

/**
 * Main import function
 */
async function importArchived() {
  console.log('='.repeat(80));
  console.log('IMPORT ARCHIVED REQ FILES TO DATABASE');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Find all archived REQ files
  console.log('Step 1: Scanning archived REQ files...');
  console.log('-'.repeat(80));

  const allFiles = findArchivedReqFiles(ARCHIVE_BASE);
  stats.totalFound = allFiles.length;

  console.log(`Found ${stats.totalFound} archived REQ files`);
  console.log();

  if (stats.totalFound === 0) {
    console.log('No archived REQ files found.');
    return;
  }

  // Step 2: Parse files
  console.log('Step 2: Parsing REQ files...');
  console.log('-'.repeat(80));

  const reqFiles: ReqFile[] = [];
  for (const filePath of allFiles) {
    const reqFile = parseReqFile(filePath);
    if (reqFile) {
      reqFiles.push(reqFile);
    }
  }

  console.log(`Parsed: ${reqFiles.length} files`);
  console.log();

  // Step 3: Connect to database
  console.log('Step 3: Connecting to database...');
  console.log('-'.repeat(80));

  const client = new Client(DB_CONFIG);

  try {
    await client.connect();
    console.log('✓ Database connected');
    console.log();

    // Step 4: Import to database
    console.log('Step 4: Importing to database...');
    console.log('-'.repeat(80));

    for (const reqFile of reqFiles) {
      const imported = await importToDatabase(client, reqFile);
      if (imported) {
        stats.imported++;
      }
    }

    console.log();

  } catch (error) {
    console.error('✗ Database error:', error);
    stats.errors.push(`Database error: ${error}`);
  } finally {
    await client.end();
  }

  // Step 5: Final report
  console.log('='.repeat(80));
  console.log('IMPORT REPORT');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total archived files: ${stats.totalFound}`);
  console.log(`Successfully imported: ${stats.imported}`);
  console.log(`Skipped (duplicates): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log();

  if (stats.errors.length > 0 && stats.errors.length <= 10) {
    console.log('Errors encountered:');
    stats.errors.forEach(error => console.log(`  - ${error}`));
    console.log();
  }

  if (stats.imported > 0) {
    console.log('✓✓✓ SUCCESS! REQ files imported to database! ✓✓✓');
  }

  console.log('='.repeat(80));
}

// Run import
importArchived().catch(console.error);
