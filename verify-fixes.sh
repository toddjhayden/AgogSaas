#!/bin/bash
# Quick verification script for Billy's QA findings
# Run after fixing P0 issues

echo "🔍 Billy's QA Verification Script"
echo "=================================="
echo ""

echo "1️⃣ Checking if useState import exists in source..."
grep -n "import.*useState" Implementation/print-industry-erp/frontend/src/pages/BinOptimizationHealthDashboard.tsx
echo ""

echo "2️⃣ Checking TypeScript compilation..."
cd Implementation/print-industry-erp/frontend
npm run build 2>&1 | grep -E "(error|✓ built)"
echo ""

echo "3️⃣ Checking if dev server is running..."
curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "Backend: %{http_code}\n" http://localhost:4000/graphql
echo ""

echo "4️⃣ Testing critical page (Bin Health Dashboard)..."
cd ../../../
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3000/wms/health', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const hasError = await page.locator('text=Something went wrong').count() > 0;

  console.log('Page loaded:', !hasError);
  console.log('Errors found:', errors.length);
  if (errors.length > 0) {
    console.log('First error:', errors[0].substring(0, 100));
  }

  await browser.close();
  process.exit(errors.length > 0 || hasError ? 1 : 0);
})();
" && echo "✅ PASS: No errors found" || echo "❌ FAIL: Errors still present"

echo ""
echo "=================================="
echo "Verification complete!"
