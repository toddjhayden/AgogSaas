/**
 * Comprehensive Frontend Page Testing Script
 * Tests all routes after Jen's TypeScript fixes
 * @author Billy (QA Engineer)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, 'test-screenshots');
const TIMEOUT = 30000; // 30 seconds per page

// All routes to test
const ROUTES = [
  { name: 'Root Redirect', path: '/', expectedRedirect: '/dashboard' },
  { name: 'Executive Dashboard', path: '/dashboard' },
  { name: 'Operations Dashboard', path: '/operations' },
  { name: 'WMS Dashboard', path: '/wms' },
  { name: 'Finance Dashboard', path: '/finance' },
  { name: 'Quality Dashboard', path: '/quality' },
  { name: 'Marketplace Dashboard', path: '/marketplace' },
  { name: 'KPI Explorer', path: '/kpis' },
  { name: 'Monitoring Dashboard', path: '/monitoring' },
  { name: 'Orchestrator Dashboard', path: '/orchestrator' },
  { name: 'Purchase Orders', path: '/procurement/purchase-orders' },
  { name: 'Create Purchase Order', path: '/procurement/purchase-orders/new' },
  { name: 'Bin Utilization Dashboard', path: '/wms/bin-utilization' },
  { name: 'Bin Utilization Enhanced', path: '/wms/bin-utilization-enhanced' },
  { name: 'Bin Health Dashboard', path: '/wms/health' },
  { name: 'Bin Data Quality', path: '/wms/data-quality' }
];

// Test results storage
const results = {
  totalPages: ROUTES.length,
  passed: 0,
  failed: 0,
  tests: []
};

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testPage(page, route) {
  const result = {
    name: route.name,
    path: route.path,
    url: BASE_URL + route.path,
    status: 'PASS',
    errors: [],
    warnings: [],
    consoleErrors: [],
    screenshot: null,
    timestamp: new Date().toISOString(),
    loadTime: 0
  };

  const startTime = Date.now();

  try {
    console.log(`\n🔍 Testing: ${route.name} (${route.path})`);

    // Collect console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        result.consoleErrors.push(text);
      } else if (type === 'warning') {
        result.warnings.push(text);
      }
    });

    // Collect page errors
    page.on('pageerror', (error) => {
      result.errors.push(error.message);
    });

    // Navigate to the page
    const response = await page.goto(result.url, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT
    });

    result.loadTime = Date.now() - startTime;

    // Check response status
    if (!response || !response.ok()) {
      result.status = 'FAIL';
      result.errors.push(`HTTP ${response?.status()}: Page failed to load`);
      return result;
    }

    // Wait for React to render
    await page.waitForTimeout(2000);

    // Check if we got redirected (for root path)
    const currentUrl = page.url();
    if (route.expectedRedirect) {
      if (!currentUrl.includes(route.expectedRedirect)) {
        result.status = 'FAIL';
        result.errors.push(`Expected redirect to ${route.expectedRedirect}, but got ${currentUrl}`);
      } else {
        console.log(`✅ Redirected correctly to ${route.expectedRedirect}`);
      }
    }

    // Check for error boundary or blank page
    const errorBoundary = await page.locator('text=Something went wrong').count();
    if (errorBoundary > 0) {
      result.status = 'FAIL';
      result.errors.push('Error boundary triggered - component crashed');
    }

    // Check if page has content (not blank)
    const bodyText = await page.locator('body').textContent();
    if (!bodyText || bodyText.trim().length < 10) {
      result.status = 'FAIL';
      result.errors.push('Page appears to be blank or has minimal content');
    }

    // Check for common UI elements (sidebar, header, etc.)
    const hasContent = await page.locator('main, [role="main"], .MuiBox-root').count();
    if (hasContent === 0) {
      result.warnings.push('No main content container found');
    }

    // Take screenshot
    const screenshotFilename = `${route.path.replace(/\//g, '_')}_${Date.now()}.png`;
    result.screenshot = path.join(SCREENSHOT_DIR, screenshotFilename);
    await page.screenshot({
      path: result.screenshot,
      fullPage: true
    });

    // Check for critical console errors
    const criticalErrors = result.consoleErrors.filter(err =>
      !err.includes('Warning:') &&
      !err.includes('ResizeObserver') &&
      !err.includes('React does not recognize')
    );

    if (criticalErrors.length > 0) {
      result.status = 'FAIL';
      result.errors.push(`${criticalErrors.length} critical console errors detected`);
    }

    // If we have errors, mark as failed
    if (result.errors.length > 0) {
      result.status = 'FAIL';
    }

    console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${result.status}: ${route.name} (${result.loadTime}ms)`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
    if (result.consoleErrors.length > 0) {
      console.log(`   Console Errors: ${result.consoleErrors.length}`);
    }

  } catch (error) {
    result.status = 'FAIL';
    result.errors.push(`Test exception: ${error.message}`);
    console.log(`❌ FAIL: ${route.name} - ${error.message}`);
  }

  return result;
}

async function runTests() {
  console.log('🚀 Starting Comprehensive Frontend QA Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📊 Total Pages to Test: ${ROUTES.length}`);
  console.log('═══════════════════════════════════════════════\n');

  let browser;
  let page;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    page = await context.newPage();

    // Test each route
    for (const route of ROUTES) {
      const result = await testPage(page, route);
      results.tests.push(result);

      if (result.status === 'PASS') {
        results.passed++;
      } else {
        results.failed++;
      }

      // Small delay between tests
      await page.waitForTimeout(500);
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`Total Pages Tested: ${results.totalPages}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / results.totalPages) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════\n');

  // Save results to JSON
  const resultsFile = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`📄 Results saved to: ${resultsFile}`);
  console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

  return results;
}

// Run the tests
runTests().then((results) => {
  process.exit(results.failed > 0 ? 1 : 0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
