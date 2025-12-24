#!/usr/bin/env node

/**
 * Verify Agent Setup
 * Checks that all required files exist before spawning agent
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');

console.log('🔍 Verifying Agent Setup...\n');

// Check files
const checks = [
  {
    name: 'Agent Definition',
    path: path.join(baseDir, '.claude', 'agents', 'value-chain-expert.md'),
  },
  {
    name: 'Standards',
    path: path.join(baseDir, 'Standards', 'README.md'),
  },
  {
    name: 'Project Spirit Directory',
    path: path.join(baseDir, 'project-spirit'),
  },
];

let allPassed = true;

checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  const icon = exists ? '✅' : '❌';
  console.log(`${icon} ${check.name}`);
  console.log(`   ${check.path}`);

  if (exists && fs.statSync(check.path).isDirectory()) {
    const files = fs.readdirSync(check.path, { recursive: true })
      .filter(f => fs.statSync(path.join(check.path, f)).isFile());
    console.log(`   (${files.length} files)`);
  } else if (exists) {
    const size = fs.statSync(check.path).size;
    console.log(`   (${(size / 1024).toFixed(1)} KB)`);
  }

  console.log('');
  if (!exists) allPassed = false;
});

// List project spirit files
if (fs.existsSync(path.join(baseDir, 'project-spirit'))) {
  console.log('📂 Project Spirit Files:');
  const files = fs.readdirSync(path.join(baseDir, 'project-spirit'), { recursive: true })
    .filter(f => fs.statSync(path.join(baseDir, 'project-spirit', f)).isFile());

  files.forEach(f => {
    console.log(`   - ${f}`);
  });
  console.log('');
}

// Summary
console.log('═'.repeat(60));
if (allPassed) {
  console.log('✅ All checks passed! You can run:');
  console.log('   node scripts/spawn-value-chain-expert.js');
  console.log('   OR');
  console.log('   scripts\\spawn-value-chain-expert.bat (Windows)');
  console.log('   OR');
  console.log('   ./scripts/spawn-value-chain-expert.sh (Linux/Mac)');
} else {
  console.log('❌ Some files are missing. Please check the errors above.');
  process.exit(1);
}
console.log('═'.repeat(60));
