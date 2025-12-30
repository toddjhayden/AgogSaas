#!/usr/bin/env ts-node
/**
 * Comprehensive REQ File Cleanup Script
 *
 * This script:
 * 1. Finds ALL REQ files in the Implementation directory
 * 2. Imports them to the agent_memory database
 * 3. Archives them to preserve audit trail
 * 4. Verifies cleanup completion
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

// Directories to scan
const SCAN_DIRS = [
  'D:/GitHub/agogsaas/Implementation/print-industry-erp/backend',
  'D:/GitHub/agogsaas/Implementation/print-industry-erp/frontend',
  'D:/GitHub/agogsaas/Implementation',
];

const ARCHIVE_BASE = 'D:/GitHub/agogsaas/Implementation/.archive/orphaned-deliverables';

interface ReqFile {
  path: string;
  filename: string;
  content: string;
  agentName: string;
  reqNumber: string;
  timestamp: Date;
  type: 'deliverable' | 'research' | 'critique' | 'qa' | 'completion' | 'other';
}

interface CleanupStats {
  totalFound: number;
  byDirectory: Map<string, number>;
  imported: number;
  archived: number;
  errors: string[];
  skipped: string[];
}

const stats: CleanupStats = {
  totalFound: 0,
  byDirectory: new Map(),
  imported: 0,
  archived: 0,
  errors: [],
  skipped: [],
};

/**
 * Recursively find all REQ files in a directory
 */
function findReqFiles(dir: string, excludeArchive = true): string[] {
  const results: string[] = [];

  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return results;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip archive directory, node_modules, .git
      if (excludeArchive && (
        fullPath.includes('.archive') ||
        fullPath.includes('node_modules') ||
        fullPath.includes('.git')
      )) {
        continue;
      }

      if (entry.isDirectory()) {
        results.push(...findReqFiles(fullPath, excludeArchive));
      } else if (entry.isFile()) {
        const filename = entry.name;
        // Match any file with REQ- or _REQ- in the name
        if (
          (filename.includes('REQ-') || filename.includes('_REQ-')) &&
          (filename.endsWith('.md') || filename.endsWith('.json'))
        ) {
          // Skip legitimate scripts
          if (!fullPath.includes('/scripts/publish-') &&
              !fullPath.includes('/nats-scripts/')) {
            results.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error);
    stats.errors.push(`Error scanning ${dir}: ${error}`);
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

    // Extract agent name
    let agentName = 'UNKNOWN';
    const agentPatterns = [
      /^([A-Z]+)_/,  // CYNTHIA_REQ-...
      /_([A-Z]+)_/,  // REQ-..._CYNTHIA_...
      /REQ-[A-Z-]+\d+-([a-z]+)-/i,  // REQ-XXX-001-cynthia-...
    ];

    for (const pattern of agentPatterns) {
      const match = filename.match(pattern);
      if (match) {
        agentName = match[1].toUpperCase();
        break;
      }
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

    // Extract timestamp from filename or use file mtime
    let timestamp = new Date();
    const timestampMatch = filename.match(/(\d{13})/);
    if (timestampMatch) {
      timestamp = new Date(parseInt(timestampMatch[1]));
    } else {
      const stats = fs.statSync(filePath);
      timestamp = stats.mtime;
    }

    // Determine type
    let type: ReqFile['type'] = 'other';
    if (filename.includes('DELIVERABLE')) type = 'deliverable';
    else if (filename.includes('RESEARCH')) type = 'research';
    else if (filename.includes('CRITIQUE')) type = 'critique';
    else if (filename.includes('QA')) type = 'qa';
    else if (filename.includes('COMPLETION')) type = 'completion';

    return {
      path: filePath,
      filename,
      content,
      agentName,
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
    // Create a memory record
    const query = `
      INSERT INTO public.memories (
        agent_name,
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
    };

    const result = await client.query(query, [
      reqFile.agentName,
      'deliverable',
      reqFile.content,
      JSON.stringify(metadata),
      reqFile.timestamp,
    ]);

    if (result.rowCount && result.rowCount > 0) {
      console.log(`✓ Imported: ${reqFile.filename} (Agent: ${reqFile.agentName}, REQ: ${reqFile.reqNumber})`);
      return true;
    } else {
      console.log(`⊘ Skipped (duplicate): ${reqFile.filename}`);
      stats.skipped.push(reqFile.filename);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error importing ${reqFile.filename}:`, error);
    stats.errors.push(`Error importing ${reqFile.filename}: ${error}`);
    return false;
  }
}

/**
 * Archive REQ file
 */
function archiveFile(reqFile: ReqFile): boolean {
  try {
    const dateStr = reqFile.timestamp.toISOString().split('T')[0];
    const archiveDir = path.join(ARCHIVE_BASE, reqFile.agentName, dateStr);

    // Create archive directory
    fs.mkdirSync(archiveDir, { recursive: true });

    const archivePath = path.join(archiveDir, reqFile.filename);

    // Move file to archive
    fs.renameSync(reqFile.path, archivePath);

    console.log(`✓ Archived: ${reqFile.filename} → ${archivePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error archiving ${reqFile.filename}:`, error);
    stats.errors.push(`Error archiving ${reqFile.filename}: ${error}`);
    return false;
  }
}

/**
 * Main cleanup function
 */
async function cleanup() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE REQ FILE CLEANUP');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Find all REQ files
  console.log('Step 1: Scanning for REQ files...');
  console.log('-'.repeat(80));

  const allFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    console.log(`Scanning: ${dir}`);
    const files = findReqFiles(dir);
    allFiles.push(...files);
    stats.byDirectory.set(dir, files.length);
    console.log(`  Found: ${files.length} files`);
  }

  stats.totalFound = allFiles.length;
  console.log();
  console.log(`Total REQ files found: ${stats.totalFound}`);
  console.log();

  if (stats.totalFound === 0) {
    console.log('✓ No REQ files found. Cleanup complete!');
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

    // Check if memories table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'memories'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('✗ Error: memories table does not exist!');
      console.log('Please run database migrations first.');
      return;
    }

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
    console.log(`Imported: ${stats.imported} files`);
    console.log(`Skipped (duplicates): ${stats.skipped.length} files`);
    console.log();

    // Step 5: Archive files
    console.log('Step 5: Archiving files...');
    console.log('-'.repeat(80));

    for (const reqFile of reqFiles) {
      const archived = archiveFile(reqFile);
      if (archived) {
        stats.archived++;
      }
    }

    console.log();
    console.log(`Archived: ${stats.archived} files`);
    console.log();

  } catch (error) {
    console.error('✗ Database error:', error);
    stats.errors.push(`Database error: ${error}`);
  } finally {
    await client.end();
  }

  // Step 6: Verify cleanup
  console.log('Step 6: Verifying cleanup...');
  console.log('-'.repeat(80));

  const remainingFiles: string[] = [];
  for (const dir of SCAN_DIRS) {
    const files = findReqFiles(dir);
    remainingFiles.push(...files);
  }

  console.log(`Backend: ${findReqFiles(SCAN_DIRS[0]).length} REQ files remaining`);
  console.log(`Frontend: ${findReqFiles(SCAN_DIRS[1]).length} REQ files remaining`);
  console.log(`Root: ${findReqFiles(SCAN_DIRS[2]).length} REQ files remaining`);
  console.log();

  // Step 7: Final report
  console.log('='.repeat(80));
  console.log('CLEANUP REPORT');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total REQ files found: ${stats.totalFound}`);
  stats.byDirectory.forEach((count, dir) => {
    const dirName = dir.split('/').pop() || dir;
    console.log(`  - ${dirName}: ${count} files`);
  });
  console.log();
  console.log(`Database imports: ${stats.imported} successful`);
  console.log(`Files archived: ${stats.archived}`);
  console.log(`Skipped (duplicates): ${stats.skipped.length}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log();

  if (stats.errors.length > 0) {
    console.log('Errors encountered:');
    stats.errors.forEach(error => console.log(`  - ${error}`));
    console.log();
  }

  console.log('VERIFICATION:');
  console.log(`✓ Backend REQ files remaining: ${findReqFiles(SCAN_DIRS[0]).length}`);
  console.log(`✓ Frontend REQ files remaining: ${findReqFiles(SCAN_DIRS[1]).length}`);
  console.log(`✓ Root REQ files remaining: ${findReqFiles(SCAN_DIRS[2]).length}`);
  console.log();
  console.log(`Archive location: ${ARCHIVE_BASE}`);
  console.log();

  if (remainingFiles.length === 0) {
    console.log('✓✓✓ SUCCESS! All REQ files cleaned up! ✓✓✓');
  } else {
    console.log('⚠ WARNING: Some REQ files remain:');
    remainingFiles.forEach(file => console.log(`  - ${file}`));
  }

  console.log('='.repeat(80));
}

// Run cleanup
cleanup().catch(console.error);
