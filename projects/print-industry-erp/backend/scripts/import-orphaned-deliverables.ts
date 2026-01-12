import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

/**
 * Import Orphaned Agent Deliverables
 *
 * Purpose: Import orphaned REQ deliverable files that were written to disk
 * when NATS was down and couldn't be published to the message bus.
 *
 * These files will be:
 * 1. Parsed to extract agent name, REQ number, content, and timestamp
 * 2. Inserted into the 'memories' table as agent deliverables
 * 3. Moved to archive directory for audit trail
 */

interface DeliverableFile {
  filePath: string;
  fileName: string;
  agentName: string;
  reqNumber: string;
  timestamp: number;
  deliverableType: string;
  isJson: boolean;
}

interface ImportResult {
  totalFiles: number;
  successfulImports: number;
  failedImports: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
  processedFiles: DeliverableFile[];
}

// Database configuration (Agent Memory Database)
const pool = new Pool({
  host: 'localhost',
  port: 5434, // Agent PostgreSQL port
  database: 'agent_memory',
  user: 'agent_user',
  password: 'agent_dev_password_2024',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Archive directory
const ARCHIVE_DIR = 'D:/GitHub/agogsaas/Implementation/.archive/orphaned-deliverables';

/**
 * Parse filename to extract metadata
 */
function parseFileName(fileName: string): Partial<DeliverableFile> | null {
  // Pattern 1: AGENT_TYPE_DELIVERABLE_REQ-STRATEGIC-AUTO-TIMESTAMP.md
  const pattern1 = /^([A-Z]+)_([A-Z_]+)_(?:DELIVERABLE_)?REQ-STRATEGIC-AUTO-(\d+)(?:_([A-Z]+))?\.md$/;
  const match1 = fileName.match(pattern1);

  if (match1) {
    const [, agentName, deliverableType, timestamp, suffix] = match1;
    return {
      agentName: agentName.toUpperCase(),
      reqNumber: `REQ-STRATEGIC-AUTO-${timestamp}`,
      timestamp: parseInt(timestamp),
      deliverableType: deliverableType.toLowerCase(),
      isJson: false,
    };
  }

  // Pattern 2: COMPLETION_NOTICE_REQ-STRATEGIC-AUTO-TIMESTAMP_AGENT.json
  const pattern2 = /^COMPLETION_NOTICE_REQ-STRATEGIC-AUTO-(\d+)(?:_([A-Z]+))?\.json$/;
  const match2 = fileName.match(pattern2);

  if (match2) {
    const [, timestamp, agentName] = match2;
    return {
      agentName: agentName || 'UNKNOWN',
      reqNumber: `REQ-STRATEGIC-AUTO-${timestamp}`,
      timestamp: parseInt(timestamp),
      deliverableType: 'completion_notice',
      isJson: true,
    };
  }

  // Pattern 3: REQ-STRATEGIC-AUTO-TIMESTAMP_AGENT_TYPE.md (older format)
  const pattern3 = /^REQ-STRATEGIC-AUTO-(\d+)_([A-Z]+)_([A-Z_]+)\.md$/;
  const match3 = fileName.match(pattern3);

  if (match3) {
    const [, timestamp, agentName, deliverableType] = match3;
    return {
      agentName: agentName.toUpperCase(),
      reqNumber: `REQ-STRATEGIC-AUTO-${timestamp}`,
      timestamp: parseInt(timestamp),
      deliverableType: deliverableType.toLowerCase(),
      isJson: false,
    };
  }

  return null;
}

/**
 * Recursively find all REQ deliverable files
 */
function findDeliverableFiles(rootDir: string): DeliverableFile[] {
  const files: DeliverableFile[] = [];

  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip archive and node_modules directories
        if (entry.name !== '.archive' && entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        const parsed = parseFileName(entry.name);
        if (parsed) {
          files.push({
            filePath: fullPath,
            fileName: entry.name,
            agentName: parsed.agentName!,
            reqNumber: parsed.reqNumber!,
            timestamp: parsed.timestamp!,
            deliverableType: parsed.deliverableType!,
            isJson: parsed.isJson!,
          });
        }
      }
    }
  }

  scanDirectory(rootDir);
  return files;
}

/**
 * Read file content
 */
function readFileContent(filePath: string, isJson: boolean): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (isJson) {
    // Pretty-print JSON for storage
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return content;
    }
  }
  return content;
}

/**
 * Insert deliverable into database
 */
async function insertDeliverable(file: DeliverableFile): Promise<void> {
  const content = readFileContent(file.filePath, file.isJson);

  // Check if already exists
  const existingQuery = `
    SELECT id FROM public.memories
    WHERE agent_id = $1
    AND metadata->>'req_number' = $2
    AND memory_type = 'deliverable'
  `;

  const existing = await pool.query(existingQuery, [file.agentName, file.reqNumber]);

  if (existing.rows.length > 0) {
    console.log(`  ⚠️  Skipping duplicate: ${file.fileName}`);
    return;
  }

  const insertQuery = `
    INSERT INTO public.memories (
      agent_id,
      memory_type,
      content,
      metadata,
      created_at
    ) VALUES ($1, $2, $3, $4, $5)
  `;

  const metadata = {
    req_number: file.reqNumber,
    deliverable_type: file.deliverableType,
    original_filename: file.fileName,
    original_path: file.filePath,
    imported_at: new Date().toISOString(),
    source: 'orphaned_file_import',
  };

  const createdAt = new Date(file.timestamp);

  await pool.query(insertQuery, [
    file.agentName,
    'deliverable',
    content,
    JSON.stringify(metadata),
    createdAt,
  ]);

  console.log(`  ✓ Imported: ${file.fileName}`);
}

/**
 * Move file to archive
 */
function archiveFile(file: DeliverableFile): void {
  // Create archive directory structure: ARCHIVE_DIR/AGENT_NAME/YYYY-MM-DD/
  const date = new Date(file.timestamp);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const archiveSubDir = path.join(ARCHIVE_DIR, file.agentName, dateStr);

  // Ensure directory exists
  fs.mkdirSync(archiveSubDir, { recursive: true });

  // Move file
  const archivePath = path.join(archiveSubDir, file.fileName);
  fs.renameSync(file.filePath, archivePath);

  console.log(`  📦 Archived: ${file.fileName} -> ${archiveSubDir}`);
}

/**
 * Main import function
 */
async function importOrphanedDeliverables(): Promise<ImportResult> {
  console.log('🔍 Scanning for orphaned deliverable files...\n');

  const implementationDir = 'D:/GitHub/agogsaas/Implementation';
  const files = findDeliverableFiles(implementationDir);

  console.log(`📊 Found ${files.length} deliverable files\n`);

  // Group by agent
  const byAgent = files.reduce((acc, file) => {
    if (!acc[file.agentName]) acc[file.agentName] = [];
    acc[file.agentName].push(file);
    return acc;
  }, {} as Record<string, DeliverableFile[]>);

  console.log('📋 Breakdown by agent:');
  for (const [agent, agentFiles] of Object.entries(byAgent)) {
    console.log(`   ${agent}: ${agentFiles.length} files`);
  }
  console.log('');

  const result: ImportResult = {
    totalFiles: files.length,
    successfulImports: 0,
    failedImports: 0,
    skippedFiles: 0,
    errors: [],
    processedFiles: [],
  };

  // Test database connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }

  // Process each file
  console.log('📥 Importing deliverables...\n');

  for (const file of files) {
    try {
      await insertDeliverable(file);
      result.successfulImports++;
      result.processedFiles.push(file);
    } catch (error) {
      const err = error as Error;
      if (err.message?.includes('duplicate') || err.message?.includes('Skipping')) {
        result.skippedFiles++;
      } else {
        result.failedImports++;
        result.errors.push({
          file: file.fileName,
          error: err.message || String(error),
        });
        console.error(`  ❌ Failed: ${file.fileName} - ${err.message}`);
      }
    }
  }

  console.log('\n📦 Archiving processed files...\n');

  // Archive successfully imported files
  for (const file of result.processedFiles) {
    try {
      archiveFile(file);
    } catch (error) {
      const err = error as Error;
      console.error(`  ⚠️  Failed to archive ${file.fileName}: ${err.message}`);
    }
  }

  return result;
}

/**
 * Generate summary report
 */
function generateReport(result: ImportResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 IMPORT SUMMARY REPORT');
  console.log('='.repeat(80));
  console.log(`Total files found:           ${result.totalFiles}`);
  console.log(`Files imported successfully: ${result.successfulImports}`);
  console.log(`Files skipped (duplicates):  ${result.skippedFiles}`);
  console.log(`Files failed:                ${result.failedImports}`);
  console.log(`Files moved to archive:      ${result.processedFiles.length}`);
  console.log('');
  console.log(`Archive location:            ${ARCHIVE_DIR}`);
  console.log('='.repeat(80));

  if (result.errors.length > 0) {
    console.log('\n⚠️  ERRORS ENCOUNTERED:\n');
    result.errors.forEach(({ file, error }) => {
      console.log(`   ${file}: ${error}`);
    });
  }

  console.log('\n✅ Import complete!\n');
}

/**
 * Verify imports
 */
async function verifyImports(result: ImportResult): Promise<void> {
  console.log('\n🔍 Verifying database imports...\n');

  const query = `
    SELECT
      agent_id,
      COUNT(*) as deliverable_count,
      MIN(created_at) as earliest,
      MAX(created_at) as latest
    FROM public.memories
    WHERE memory_type = 'deliverable'
    AND metadata->>'source' = 'orphaned_file_import'
    GROUP BY agent_id
    ORDER BY agent_id
  `;

  const res = await pool.query(query);

  console.log('📊 Database records by agent:');
  res.rows.forEach(row => {
    console.log(`   ${row.agent_id}: ${row.deliverable_count} deliverables (${row.earliest.toISOString().split('T')[0]} to ${row.latest.toISOString().split('T')[0]})`);
  });

  const totalQuery = `
    SELECT COUNT(*) as total
    FROM public.memories
    WHERE memory_type = 'deliverable'
    AND metadata->>'source' = 'orphaned_file_import'
  `;

  const totalRes = await pool.query(totalQuery);
  console.log(`\n✓ Total records in database: ${totalRes.rows[0].total}\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 Orphaned Deliverables Import Tool\n');
  console.log('This tool will:');
  console.log('  1. Find all orphaned REQ deliverable files');
  console.log('  2. Import them into the memories table');
  console.log('  3. Move processed files to archive directory');
  console.log('  4. Generate a summary report\n');

  try {
    const result = await importOrphanedDeliverables();
    await verifyImports(result);
    generateReport(result);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { importOrphanedDeliverables, parseFileName, findDeliverableFiles };
