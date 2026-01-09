/**
 * Script to batch-fix common 'any' type patterns in frontend
 * REQ-LINT-1767982183
 */
const fs = require('fs');
const path = require('path');

const fixes = [
  // Pattern 1: catch (error: any) => catch (error: unknown)
  {
    pattern: /catch\s*\(\s*(\w+)\s*:\s*any\s*\)/g,
    replacement: 'catch ($1: unknown)'
  },
  // Pattern 2: (entry: any) => (entry: unknown) in simple map operations
  {
    pattern: /\((\w+):\s*any\)\s*=>/g,
    replacement: '($1: unknown) =>'
  },
  // Pattern 3: Record<string, any> => Record<string, unknown>
  {
    pattern: /Record<string,\s*any>/g,
    replacement: 'Record<string, unknown>'
  },
  // Pattern 4: as any => as unknown (safer cast)
  {
    pattern: /as\s+any([^a-zA-Z])/g,
    replacement: 'as unknown$1'
  }
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  fixes.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const srcDir = path.join(__dirname, 'src');
const files = walkDir(srcDir);
let fixedCount = 0;

files.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\nFixed ${fixedCount} files`);
