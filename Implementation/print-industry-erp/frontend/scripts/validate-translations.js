/**
 * Translation Validation Script
 *
 * This script validates that all translation files have consistent keys
 * and identifies missing translations.
 *
 * Usage: node scripts/validate-translations.js
 * Exit code: 0 = success, 1 = validation failed
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

/**
 * Recursively extract all keys from a nested object
 */
function extractKeys(obj, prefix = '') {
  const keys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Nested object, recurse
      keys.push(...extractKeys(obj[key], fullKey));
    } else {
      // Leaf key
      keys.push(fullKey);
    }
  }

  return keys.sort();
}

/**
 * Load and parse a translation JSON file
 */
function loadTranslationFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading ${filePath}:${colors.reset}`, error);
    process.exit(1);
  }
}

/**
 * Main validation function
 */
function validateTranslations() {
  const localesDir = path.join(__dirname, '../src/i18n/locales');

  // Load translation files
  const enPath = path.join(localesDir, 'en-US.json');
  const zhPath = path.join(localesDir, 'zh-CN.json');

  console.log(`${colors.blue}Translation Validation Report${colors.reset}`);
  console.log('═'.repeat(60));

  const enTranslations = loadTranslationFile(enPath);
  const zhTranslations = loadTranslationFile(zhPath);

  const enKeys = extractKeys(enTranslations);
  const zhKeys = extractKeys(zhTranslations);

  console.log(`\nEnglish (en-US): ${enKeys.length} keys`);
  console.log(`Chinese (zh-CN): ${zhKeys.length} keys`);

  // Find missing keys in Chinese
  const missingInChinese = enKeys.filter(key => !zhKeys.includes(key));

  // Find extra keys in Chinese (not in English - possible typos or removed keys)
  const extraInChinese = zhKeys.filter(key => !enKeys.includes(key));

  // Calculate coverage
  const coverage = ((zhKeys.length / enKeys.length) * 100).toFixed(1);

  console.log(`\nTranslation Coverage: ${coverage}%`);
  console.log('─'.repeat(60));

  // Report missing keys
  if (missingInChinese.length > 0) {
    console.log(`\n${colors.red}✗ Missing ${missingInChinese.length} Chinese translations:${colors.reset}`);
    missingInChinese.slice(0, 20).forEach(key => {
      console.log(`  - ${key}`);
    });
    if (missingInChinese.length > 20) {
      console.log(`  ... and ${missingInChinese.length - 20} more`);
    }
  } else {
    console.log(`\n${colors.green}✓ All English keys have Chinese translations!${colors.reset}`);
  }

  // Report extra keys
  if (extraInChinese.length > 0) {
    console.log(`\n${colors.yellow}⚠ Found ${extraInChinese.length} extra Chinese keys (not in English):${colors.reset}`);
    extraInChinese.slice(0, 10).forEach(key => {
      console.log(`  - ${key}`);
    });
    if (extraInChinese.length > 10) {
      console.log(`  ... and ${extraInChinese.length - 10} more`);
    }
  }

  console.log('\n' + '═'.repeat(60));

  // Determine exit code
  if (missingInChinese.length > 0) {
    console.log(`\n${colors.red}Validation FAILED: Chinese translations incomplete${colors.reset}`);
    console.log(`Please add ${missingInChinese.length} missing translations before deploying.\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}Validation PASSED: All translations complete!${colors.reset}\n`);
    process.exit(0);
  }
}

// Run validation
validateTranslations();
