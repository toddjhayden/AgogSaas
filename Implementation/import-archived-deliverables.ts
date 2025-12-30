#!/usr/bin/env ts-node
/**
 * Import archived deliverable files into nats_deliverable_cache database
 * Run: npx ts-node import-archived-deliverables.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  user: 'agent_user',
  password: 'agent_dev_password_2024',
  database: 'agent_memory',
});

const ARCHIVE_DIR = path.join(__dirname, '.archive', 'deliverables-backup-20251230');

// Map agent names from filenames to agent IDs
const agentMap: Record<string, { agent: string; stage: number }> = {
  'CYNTHIA_RESEARCH': { agent: 'cynthia', stage: 0 },
  'SYLVIA_CRITIQUE': { agent: 'sylvia', stage: 1 },
  'ROY_BACKEND': { agent: 'roy', stage: 2 },
  'JEN_FRONTEND': { agent: 'jen', stage: 3 },
  'BILLY_QA': { agent: 'billy', stage: 4 },
  'PRIYA_STATISTICAL': { agent: 'priya', stage: 5 },
  'BERRY_DEVOPS': { agent: 'berry', stage: 6 },
  'BERRY_DEPLOYMENT': { agent: 'berry', stage: 6 },
  'BERRY_DELIVERABLE': { agent: 'berry', stage: 6 },
};

async function importFiles() {
  const files = fs.readdirSync(ARCHIVE_DIR);
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.json')) continue;

    // Extract REQ number
    const reqMatch = file.match(/REQ-[A-Z0-9-]+/);
    if (!reqMatch) {
      console.log(`Skipping ${file}: no REQ number found`);
      skipped++;
      continue;
    }
    const reqNumber = reqMatch[0];

    // Extract agent from filename prefix
    let agentInfo: { agent: string; stage: number } | undefined;
    for (const [prefix, info] of Object.entries(agentMap)) {
      if (file.startsWith(prefix)) {
        agentInfo = info;
        break;
      }
    }

    if (!agentInfo) {
      console.log(`Skipping ${file}: unknown agent prefix`);
      skipped++;
      continue;
    }

    // Check if already exists
    const existing = await pool.query(
      'SELECT id FROM nats_deliverable_cache WHERE req_number = $1 AND agent = $2 AND stage = $3',
      [reqNumber, agentInfo.agent, agentInfo.stage]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    // Read file content
    const filePath = path.join(ARCHIVE_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Create deliverable object
    const deliverable = {
      source: 'archived_file',
      filename: file,
      content: content,
      imported_at: new Date().toISOString(),
    };

    try {
      await pool.query(
        `INSERT INTO nats_deliverable_cache (req_number, agent, stage, deliverable)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (req_number, agent, stage) DO NOTHING`,
        [reqNumber, agentInfo.agent, agentInfo.stage, JSON.stringify(deliverable)]
      );
      imported++;
      console.log(`Imported: ${file}`);
    } catch (err: any) {
      console.error(`Error importing ${file}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nImport complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  await pool.end();
}

importFiles().catch(console.error);
