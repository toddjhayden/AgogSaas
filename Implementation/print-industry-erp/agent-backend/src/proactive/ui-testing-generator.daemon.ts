/**
 * UI Testing REQ Generator Daemon
 *
 * Generates P0 testing REQs for Liz (Frontend Tester) based on:
 * - Frontend pages that exist in the codebase
 * - Recent changes to frontend files
 * - Sam's audit findings
 *
 * Triggered by:
 * - Sam after each audit (agog.testing.ui.generate)
 * - Manual trigger (agog.testing.ui.trigger)
 * - Daily schedule (optional)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const sc = StringCodec();

const CONFIG = {
  natsUrl: process.env.NATS_URL || 'nats://localhost:4223',
  natsUser: process.env.NATS_USER,
  natsPassword: process.env.NATS_PASSWORD,
  triggerSubject: 'agog.testing.ui.trigger',
  samTriggerSubject: 'agog.testing.ui.generate', // Sam calls this after audits
  reqSubject: 'agog.requirements.new',
  frontendPath: process.env.APP_FRONTEND_PATH || '/workspace/app-frontend',
};

// Core pages that should always be tested
const CORE_PAGES = [
  {
    name: 'MonitoringDashboard',
    path: '/monitoring',
    file: 'src/pages/MonitoringDashboard.tsx',
    priority: 'P0',
    testCriteria: [
      'System health cards render correctly',
      'Auto-refresh works at configured interval',
      'Error-to-REQ mappings display accurately',
      'No console errors on load'
    ]
  },
  {
    name: 'OrchestratorDashboard',
    path: '/orchestrator',
    file: 'src/pages/OrchestratorDashboard.tsx',
    priority: 'P0',
    testCriteria: [
      'Active workflows table displays correctly',
      'Status chips show correct colors',
      'Rollback/pause controls function',
      'Escalation queue renders'
    ]
  },
  {
    name: 'ExecutiveDashboard',
    path: '/executive',
    file: 'src/pages/ExecutiveDashboard.tsx',
    priority: 'P0',
    testCriteria: [
      'KPI cards render with data',
      'Facility overview displays all plants',
      'Charts render without errors',
      'Alert panel shows correctly'
    ]
  },
  {
    name: 'FinanceDashboard',
    path: '/finance',
    file: 'src/pages/FinanceDashboard.tsx',
    priority: 'P0',
    testCriteria: [
      'Financial cards load correctly',
      'P&L summary table renders',
      'Currency formatting is correct',
      'Date range picker works'
    ]
  },
  {
    name: 'InventoryForecastingDashboard',
    path: '/inventory/forecasting',
    file: 'src/pages/InventoryForecastingDashboard.tsx',
    priority: 'P0',
    testCriteria: [
      'Material selection works',
      'Forecast generation triggers correctly',
      'Accuracy metrics display properly',
      'Tables render with data'
    ]
  },
  {
    name: 'BinUtilizationDashboard',
    path: '/wms/bin-utilization',
    file: 'src/pages/BinUtilizationDashboard.tsx',
    priority: 'P0',
    testCriteria: [
      'Bin heatmap renders',
      'Utilization metrics display',
      'Optimization suggestions show',
      'Facility filter works'
    ]
  },
  {
    name: 'PurchaseOrdersPage',
    path: '/procurement/purchase-orders',
    file: 'src/pages/PurchaseOrdersPage.tsx',
    priority: 'P0',
    testCriteria: [
      'PO list loads correctly',
      'Status filters work',
      'PO details modal opens',
      'Approval workflow functions'
    ]
  }
];

class UITestingGeneratorDaemon {
  private nc: NatsConnection | null = null;
  private isRunning = false;

  async start(): Promise<void> {
    console.log('[UITestGen] UI Testing REQ Generator starting...');

    this.nc = await connect({
      servers: CONFIG.natsUrl,
      user: CONFIG.natsUser,
      pass: CONFIG.natsPassword,
      name: 'ui-testing-generator'
    });
    console.log(`[UITestGen] Connected to NATS at ${CONFIG.natsUrl}`);

    // Subscribe to manual trigger
    const manualSub = this.nc.subscribe(CONFIG.triggerSubject);
    (async () => {
      for await (const msg of manualSub) {
        console.log('[UITestGen] Manual trigger received');
        await this.generateTestingReqs('manual');
      }
    })();
    console.log(`[UITestGen] Listening on ${CONFIG.triggerSubject}`);

    // Subscribe to Sam's trigger (after audits)
    const samSub = this.nc.subscribe(CONFIG.samTriggerSubject);
    (async () => {
      for await (const msg of samSub) {
        const payload = JSON.parse(sc.decode(msg.data));
        console.log(`[UITestGen] Sam triggered UI testing after ${payload.auditType} audit`);
        await this.generateTestingReqs('sam-audit', payload);
      }
    })();
    console.log(`[UITestGen] Listening on ${CONFIG.samTriggerSubject} (Sam's trigger)`);

    this.isRunning = true;
    console.log('[UITestGen] ✅ UI Testing REQ Generator ready');
  }

  /**
   * Generate testing REQs for Liz
   */
  async generateTestingReqs(source: string, auditPayload?: any): Promise<void> {
    const timestamp = Date.now();
    const reqs: any[] = [];

    // Get pages to test based on source
    const pagesToTest = await this.determinePagesToTest(source, auditPayload);

    for (let i = 0; i < pagesToTest.length; i++) {
      const page = pagesToTest[i];
      const reqNumber = `REQ-LIZ-TEST-${timestamp}-${String(i + 1).padStart(3, '0')}`;

      const req = {
        reqNumber,
        title: `[UI Test] ${page.name} - Verify functionality and UX`,
        priority: page.priority,
        owner: 'liz',
        source: `ui-testing-generator:${source}`,
        assignedAgent: 'liz',
        testScope: page.file,
        testPath: page.path,
        createdAt: new Date().toISOString(),
        description: `
## UI Testing Required for ${page.name}

**Page Path:** ${page.path}
**Source File:** ${page.file}
**Generated By:** UI Testing Generator (${source})
**Priority:** ${page.priority}

### Test Criteria:
${page.testCriteria.map((c: string) => `- [ ] ${c}`).join('\n')}

### Instructions for Liz:
1. Navigate to ${page.path} using Playwright MCP
2. Verify all test criteria pass
3. Check for console errors
4. Test responsive layout (mobile/tablet/desktop)
5. Run accessibility audit
6. Create bug REQs for any issues found

### Evidence Required:
- Screenshot of working page
- Console log (no errors)
- Accessibility score (target: 90%+)
        `.trim(),
        testCriteria: page.testCriteria
      };

      reqs.push(req);
    }

    // Publish all REQs to NATS
    for (const req of reqs) {
      this.nc!.publish(CONFIG.reqSubject, sc.encode(JSON.stringify(req)));
      console.log(`[UITestGen] Published: ${req.reqNumber} - ${req.title}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`[UITestGen] ✅ Generated ${reqs.length} P0 UI testing REQs for Liz`);

    // Notify completion
    this.nc!.publish('agog.testing.ui.complete', sc.encode(JSON.stringify({
      source,
      reqCount: reqs.length,
      reqNumbers: reqs.map(r => r.reqNumber),
      timestamp: new Date().toISOString()
    })));
  }

  /**
   * Determine which pages need testing based on trigger source
   */
  private async determinePagesToTest(source: string, auditPayload?: any): Promise<any[]> {
    // Always test core pages
    let pagesToTest = [...CORE_PAGES];

    // If triggered by Sam's audit, check for specific issues
    if (source === 'sam-audit' && auditPayload?.recommendations) {
      // Add any pages mentioned in Sam's recommendations
      const additionalPages = this.extractPagesFromAuditFindings(auditPayload.recommendations);
      pagesToTest = [...pagesToTest, ...additionalPages];
    }

    // Check for recently modified pages
    const recentlyModified = await this.getRecentlyModifiedPages();
    for (const modPage of recentlyModified) {
      if (!pagesToTest.find(p => p.file === modPage.file)) {
        pagesToTest.push(modPage);
      }
    }

    // Deduplicate by file path
    const seen = new Set();
    return pagesToTest.filter(p => {
      if (seen.has(p.file)) return false;
      seen.add(p.file);
      return true;
    });
  }

  /**
   * Extract page references from Sam's audit findings
   */
  private extractPagesFromAuditFindings(recommendations: string[]): any[] {
    const additionalPages: any[] = [];

    for (const rec of recommendations) {
      // Look for page/component references
      const pageMatch = rec.match(/src\/pages\/(\w+)\.tsx/);
      if (pageMatch) {
        const pageName = pageMatch[1];
        additionalPages.push({
          name: pageName,
          path: `/${pageName.toLowerCase().replace('dashboard', '').replace('page', '')}`,
          file: `src/pages/${pageName}.tsx`,
          priority: 'P0',
          testCriteria: [
            'Page loads without errors',
            'No console errors',
            'Core functionality works',
            'Issue from audit is resolved'
          ]
        });
      }
    }

    return additionalPages;
  }

  /**
   * Get pages modified in the last 24 hours (when running in Docker with mounted volumes)
   */
  private async getRecentlyModifiedPages(): Promise<any[]> {
    const recentPages: any[] = [];
    const pagesDir = path.join(CONFIG.frontendPath, 'src/pages');

    try {
      if (!fs.existsSync(pagesDir)) {
        return recentPages;
      }

      const files = fs.readdirSync(pagesDir);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.endsWith('.tsx')) continue;

        const filePath = path.join(pagesDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs > oneDayAgo) {
          const pageName = file.replace('.tsx', '');
          recentPages.push({
            name: pageName,
            path: `/${pageName.toLowerCase().replace('dashboard', '').replace('page', '')}`,
            file: `src/pages/${file}`,
            priority: 'P0',
            testCriteria: [
              'Recently modified - verify no regressions',
              'Page loads correctly',
              'No console errors',
              'All interactions work'
            ]
          });
        }
      }
    } catch (error) {
      console.log('[UITestGen] Could not scan for recent changes:', error);
    }

    return recentPages;
  }

  async stop(): Promise<void> {
    console.log('[UITestGen] Stopping...');
    this.isRunning = false;
    if (this.nc) {
      await this.nc.close();
    }
  }
}

// Export for use in start-proactive-daemons.ts
export { UITestingGeneratorDaemon };

// Allow standalone running
if (require.main === module) {
  const daemon = new UITestingGeneratorDaemon();

  process.on('SIGINT', async () => {
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await daemon.stop();
    process.exit(0);
  });

  daemon.start().catch(error => {
    console.error('[UITestGen] Failed to start:', error);
    process.exit(1);
  });
}
