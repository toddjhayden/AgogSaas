const fs = require('fs');
const path = require('path');

// Read translation files
const enPath = path.join(__dirname, 'print-industry-erp/frontend/src/i18n/locales/en-US.json');
const zhPath = path.join(__dirname, 'print-industry-erp/frontend/src/i18n/locales/zh-CN.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));

// Function to find missing keys
function findMissingKeys(obj1, obj2, prefix = '') {
  const missing = [];
  for (const key in obj1) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in obj2)) {
      missing.push(fullKey);
    } else if (typeof obj1[key] === 'object' && obj1[key] !== null && !Array.isArray(obj1[key])) {
      missing.push(...findMissingKeys(obj1[key], obj2[key], fullKey));
    }
  }
  return missing;
}

// Function to count all keys
function countAllKeys(obj, prefix = '') {
  let count = 0;
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countAllKeys(obj[key], prefix ? `${prefix}.${key}` : key);
    } else {
      count++;
    }
  }
  return count;
}

const missingInZh = findMissingKeys(en, zh);
const totalEnKeys = countAllKeys(en);
const totalZhKeys = countAllKeys(zh);

console.log('=== Translation Coverage Analysis ===\n');
console.log(`Total English keys: ${totalEnKeys}`);
console.log(`Total Chinese keys: ${totalZhKeys}`);
console.log(`Missing in Chinese: ${missingInZh.length} keys (${((1 - missingInZh.length / totalEnKeys) * 100).toFixed(1)}% coverage)\n`);

console.log('=== Top-level sections in English ===');
Object.keys(en).forEach(section => {
  const sectionKeysEn = countAllKeys(en[section]);
  const sectionKeysZh = zh[section] ? countAllKeys(zh[section]) : 0;
  const coverage = sectionKeysEn > 0 ? ((sectionKeysZh / sectionKeysEn) * 100).toFixed(1) : '0.0';
  console.log(`  ${section}: ${sectionKeysZh}/${sectionKeysEn} (${coverage}%)`);
});

console.log('\n=== Missing sections in Chinese ===');
const missingSections = Object.keys(en).filter(key => !(key in zh));
if (missingSections.length > 0) {
  missingSections.forEach(section => {
    console.log(`  - ${section} (${countAllKeys(en[section])} keys)`);
  });
} else {
  console.log('  None - all top-level sections present');
}

console.log('\n=== Sample missing keys (first 30) ===');
missingInZh.slice(0, 30).forEach(key => {
  console.log(`  - ${key}`);
});

if (missingInZh.length > 30) {
  console.log(`  ... and ${missingInZh.length - 30} more`);
}
