#!/usr/bin/env ts-node

/**
 * Publish Cynthia's Research Deliverable to NATS
 * REQ-STRATEGIC-AUTO-1767048328659: Customer Portal & Self-Service Ordering
 */

import { connect, NatsConnection, StringCodec } from 'nats';
import * as fs from 'fs';
import * as path from 'path';

const REQ_NUMBER = 'REQ-STRATEGIC-AUTO-1767048328659';
const FEATURE_TITLE = 'Customer Portal & Self-Service Ordering';

interface ResearchDeliverable {
  agent: string;
  reqNumber: string;
  featureTitle: string;
  status: string;
  timestamp: string;
  researchFindings: {
    executiveSummary: string;
    currentSystemAnalysis: {
      strengths: string[];
      criticalGaps: string[];
      technologyStack: string[];
    };
    industryBestPractices: {
      marketSize: string;
      coreSelfServiceFeatures: string[];
      automationBenefits: string[];
      successFactors: string[];
    };
    technicalRequirements: {
      authenticationSecurity: string[];
      nestJSBestPractices: string[];
      requiredPackages: string[];
    };
    recommendedArchitecture: {
      dualAuthRealms: string;
      customerPortalSchema: string;
      databaseChanges: string[];
      frontendArchitecture: string;
    };
    implementationRoadmap: {
      phase1: { name: string; duration: string; effort: string; tasks: string[] };
      phase2: { name: string; duration: string; effort: string; tasks: string[] };
      phase3: { name: string; duration: string; effort: string; tasks: string[] };
      phase4: { name: string; duration: string; effort: string; tasks: string[] };
      phase5: { name: string; duration: string; effort: string; tasks: string[] };
      totalTimeline: string;
      totalEffort: string;
    };
    securityConsiderations: {
      owaspTop10Mitigations: string[];
      complianceRequirements: string[];
      monitoringAlerts: string[];
    };
  };
  deliverableUrl: string;
  fullDocumentPath: string;
  recommendations: string[];
  nextSteps: string[];
  businessImpact: string[];
  references: string[];
}

async function main() {
  let nc: NatsConnection | null = null;

  try {
    console.log('🔌 Connecting to NATS...');
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });
    console.log('✅ Connected to NATS');

    const sc = StringCodec();

    // Read the full deliverable document
    const deliverablePath = path.join(
      __dirname,
      '..',
      `CYNTHIA_RESEARCH_DELIVERABLE_${REQ_NUMBER}.md`
    );

    let deliverableContent = '';
    try {
      deliverableContent = fs.readFileSync(deliverablePath, 'utf-8');
      console.log(`📄 Read deliverable document: ${deliverablePath}`);
    } catch (err) {
      console.error(`❌ Failed to read deliverable document: ${err}`);
      process.exit(1);
    }

    // Create structured research payload
    const deliverable: ResearchDeliverable = {
      agent: 'cynthia',
      reqNumber: REQ_NUMBER,
      featureTitle: FEATURE_TITLE,
      status: 'COMPLETE',
      timestamp: new Date().toISOString(),

      researchFindings: {
        executiveSummary:
          'Comprehensive analysis reveals robust database schema and internal sales systems are production-ready, but critical customer-facing authentication and self-service capabilities are entirely missing. The $34B web-to-print market (5% annual growth) demands customer portals as a competitive necessity.',

        currentSystemAnalysis: {
          strengths: [
            'Multi-tenant architecture with UUID v7 primary keys',
            'Complete users and customers tables with authentication fields',
            'Automated quote management with pricing engine and margin validation',
            'Sales order lifecycle management with production integration',
            'Row Level Security (RLS) policies for tenant isolation',
            'GraphQL API fully defined for internal operations',
            'React + TypeScript + Apollo Client frontend architecture',
          ],
          criticalGaps: [
            'No JWT token generation or validation',
            'No login/logout endpoints',
            'No password hashing service (bcrypt not installed)',
            'No role-based access control (RBAC) middleware',
            'No customer portal authentication',
            'No customer self-service APIs',
            'No MFA enrollment or validation flow',
            'No rate limiting or API security',
            'GraphQL playground exposed (production security risk)',
            'Required NPM packages not installed: @nestjs/passport, @nestjs/jwt, passport, passport-jwt, bcrypt',
          ],
          technologyStack: [
            'Backend: NestJS (Node.js framework)',
            'Database: PostgreSQL with UUID v7 keys',
            'GraphQL: Apollo Server 5',
            'Frontend: React 18 + TypeScript + Apollo Client',
            'Missing: Passport.js, JWT strategy, bcrypt',
          ],
        },

        industryBestPractices: {
          marketSize: '$34 billion web-to-print market growing at 5% annually',
          coreSelfServiceFeatures: [
            'Quote management: Request quotes, upload artwork, receive automated estimates, approve/reject digitally',
            'Order management: Convert quotes to orders, reorder from past orders, track status, upload artwork',
            'Payment & invoicing: Make down payments, pay invoices online, view payment history',
            'Proof approval: Review digital proofs, approve/reject with comments, request revisions',
            'Personalization & templates: Variable data printing, template-based ordering, brand asset management',
            'B2B features: Multi-user accounts with approval workflows, custom catalogs, PO management',
          ],
          automationBenefits: [
            'Reduces manual workload by 60-70% (customers create estimates and place orders)',
            'Faster order processing with auto-conversion from approved quotes',
            'Improved accuracy (customer-entered data reduces transcription errors)',
            '24/7 availability (customers can place orders outside business hours)',
          ],
          successFactors: [
            'Integration with Print MIS (production management system)',
            'Template management (regularly refresh product templates)',
            'User training (onboarding for customers)',
            'Data leverage (use order history for suggestions)',
            'Customer support (responsive technical support)',
          ],
        },

        technicalRequirements: {
          authenticationSecurity: [
            'Multi-Factor Authentication (MFA): 99.9% reduction in account compromise when enabled',
            'Single Sign-On (SSO): OAuth 2.0/OIDC (Google, Microsoft, Okta), SAML 2.0 for enterprise',
            'Password Security: bcrypt hashing (salt rounds ≥ 10), complexity requirements, expiration policies',
            'Role-Based Access Control (RBAC): User roles (ADMIN, CSR, PRODUCTION_MANAGER), Customer roles (CUSTOMER_ADMIN, CUSTOMER_USER, APPROVER)',
            'Data Encryption: HTTPS/TLS, encryption at rest, GDPR/SOC 2/HIPAA compliance',
          ],
          nestJSBestPractices: [
            'Passport.js Integration: Battle-tested authentication strategies with NestJS support',
            'Refresh Token Strategy: Short-lived access tokens (15 min), long-lived refresh tokens (7 days)',
            'JWT Payload Design: Minimal payload (user ID, tenant ID, roles) to reduce size and risk',
            'Environment Configuration: Use ConfigModule and environment variables (never hardcode secrets)',
            'Token Invalidation: Short expiration times, refresh token blacklist in Redis, token versioning',
            'Guards and Decorators: JwtAuthGuard, RolesGuard for RBAC enforcement',
            'GraphQL Context Integration: Passport middleware populates req.user for resolvers',
            'Security Headers: Helmet.js for security headers, rate limiting (100 requests per 15 min)',
          ],
          requiredPackages: [
            '@nestjs/passport',
            '@nestjs/jwt',
            'passport',
            'passport-local',
            'passport-jwt',
            'bcrypt',
            'helmet',
            'express-rate-limit',
            '@nestjs/config',
            'class-validator',
            'class-transformer',
          ],
        },

        recommendedArchitecture: {
          dualAuthRealms:
            'Implement two separate authentication realms: (1) Internal Users (employees) with MFA required, biometric for vault access, 5-tier security zones, 30-min session timeout; (2) Customer Portal Users with optional MFA, Google/Microsoft SSO, 24-hour session timeout for convenience.',
          customerPortalSchema:
            'New customer_users table with customer_id FK, email, password_hash, SSO fields, MFA support, role (CUSTOMER_ADMIN/CUSTOMER_USER/APPROVER), email verification, password reset tokens, account lockout fields.',
          databaseChanges: [
            'New table: customer_users (customer portal authentication)',
            'New table: refresh_tokens (JWT token rotation)',
            'New table: artwork_files (customer uploads with virus scanning)',
            'New table: proofs (digital proof approval workflow)',
            'New table: customer_activity_log (audit trail)',
            'Enhance quotes: Add submitted_by_customer_user_id, customer_po_number',
            'Enhance sales_orders: Add placed_by_customer_user_id',
            'Enhance customers: Add portal_enabled, portal_welcome_email_sent_at',
          ],
          frontendArchitecture:
            'Separate subdomain approach recommended: portal.agog.com (customer portal) vs. app.agog.com (internal ERP). Customer portal pages: /login, /register, /dashboard, /orders, /quotes, /products, /invoices, /proofs, /settings. Reuse shared components: DataTable, Chart, ErrorBoundary.',
        },

        implementationRoadmap: {
          phase1: {
            name: 'Authentication Foundation',
            duration: 'Week 1-2',
            effort: '40-50 hours',
            tasks: [
              'Install authentication packages (@nestjs/passport, @nestjs/jwt, passport, bcrypt)',
              'Create authentication modules (auth.module.ts, auth.service.ts, strategies, guards)',
              'Create user authentication endpoints (login, logout, refresh, register)',
              'Update GraphQL context with JWT guard',
              'Database migrations for refresh_tokens table',
              'Unit and integration tests for auth flow',
            ],
          },
          phase2: {
            name: 'Customer Portal Authentication',
            duration: 'Week 3-4',
            effort: '50-60 hours',
            tasks: [
              'Database migration for customer_users table',
              'Create CustomerAuthModule with separate JWT strategy',
              'Customer authentication endpoints (register, login, password reset, email verification)',
              'Email service integration (SendGrid/AWS SES)',
              'GraphQL schema additions for customer portal',
              'Create customer portal React app (separate from internal ERP)',
              'Authentication pages (login, registration, forgot password, verification)',
              'Apollo Client configuration with JWT token handling',
              'E2E tests for registration → verification → login flow',
            ],
          },
          phase3: {
            name: 'Order History & Viewing',
            duration: 'Week 5-6',
            effort: '40-50 hours',
            tasks: [
              'Customer portal GraphQL resolvers (customerOrders, customerQuotes, customerInvoices)',
              'Enhance services to filter by customer context with RLS',
              'Add customer activity logging',
              'Customer dashboard page (recent orders, pending quotes, invoices)',
              'Order listing page with filters (status, date range, search)',
              'Order detail page (header, line items, shipment tracking, invoice download)',
              'Quote listing and detail pages',
              'Test RLS policies ensure data isolation',
              'Performance testing with large order histories',
            ],
          },
          phase4: {
            name: 'Self-Service Quote Requests',
            duration: 'Week 7-8',
            effort: '50-60 hours',
            tasks: [
              'Customer quote request mutation (creates draft quote, assigns to sales rep)',
              'Artwork upload service (S3/Azure integration, virus scanning, validation)',
              'Quote approval workflow (approve → convert to order, reject with reason)',
              'Email notifications (quote ready, quote approved/rejected)',
              'Product catalog page (browse products, view specifications)',
              'Quote request form (product selection, quantity, artwork upload, delivery date)',
              'Quote approval page (view pricing, approve/reject, enter PO number)',
              'Test quote request → review → approval → order creation flow',
              'Test artwork upload (various file types and sizes)',
            ],
          },
          phase5: {
            name: 'Advanced Features',
            duration: 'Week 9-12',
            effort: '80-100 hours',
            tasks: [
              'Multi-Factor Authentication (TOTP enrollment, verification, backup codes)',
              'SSO Integration (Google OAuth, Microsoft OAuth, SAML for enterprise)',
              'Digital proof approval (upload proof PDFs/images, customer approval, revision requests)',
              'Reorder functionality (duplicate order with new dates, saved job tickets)',
              'API rate limiting and security (Helmet.js, rate limiting, CSRF protection)',
              'MFA enrollment page (QR code, backup codes)',
              'SSO login buttons (Google, Microsoft)',
              'Proof approval interface (PDF viewer, approve/reject/revision)',
              'Quick reorder flow (one-click reorder, modify quantity/delivery)',
              'Customer admin features (manage users, invite, activity log)',
              'Security testing (penetration testing, OWASP Top 10)',
              'Load testing (100+ concurrent users)',
              'Cross-browser and mobile testing',
            ],
          },
          totalTimeline: '10-12 weeks',
          totalEffort: '260-320 hours',
        },

        securityConsiderations: {
          owaspTop10Mitigations: [
            'A01 Broken Access Control: RBAC guards, RLS policies, tenant/customer context validation',
            'A02 Cryptographic Failures: bcrypt password hashing (salt ≥ 10), HTTPS/TLS, encryption at rest',
            'A03 Injection: Parameterized queries, GraphQL query depth limiting, input validation',
            'A04 Insecure Design: Security requirements from start, threat modeling, least privilege',
            'A05 Security Misconfiguration: Disable GraphQL Playground in production, security headers',
            'A06 Vulnerable Components: Regular npm audit, Dependabot, SemVer pinning',
            'A07 Identification & Auth Failures: MFA, account lockout, password complexity, JWT short expiration',
            'A08 Software & Data Integrity: Code signing, virus scanning for uploads, CI/CD security',
            'A09 Security Logging Failures: Log all auth events, failed access attempts, audit trail, SIEM',
            'A10 Server-Side Request Forgery: Validate URLs, allowlist external APIs, no user-controlled redirects',
          ],
          complianceRequirements: [
            'GDPR: Right to access (data export), right to erasure (account deletion), right to rectification, consent management, 7-year data retention',
            'PCI DSS: Use payment gateway (Stripe/Square), tokenize credit cards, encrypt cardholder data, never store CVV',
            'SOC 2 Type II: Annual audit, security controls documentation, incident response plan, business continuity',
          ],
          monitoringAlerts: [
            'Security Monitoring: Failed login attempts (alert > 10 from single IP), unusual access patterns, large data exports, API rate limit violations',
            'Application Monitoring: APM (New Relic/Datadog), error tracking (Sentry), GraphQL performance, database slow queries',
            'Infrastructure Monitoring: Server resources (CPU/memory/disk), DB connection pool, Redis cache hit/miss, SSL certificate expiration',
          ],
        },
      },

      deliverableUrl: 'nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767048328659',
      fullDocumentPath: deliverablePath,

      recommendations: [
        'IMMEDIATE: Install authentication packages and implement Phase 1 (internal user auth) to establish authentication foundation',
        'SHORT-TERM: Build customer portal authentication (Phase 2) with separate customer_users table and JWT realm',
        'MEDIUM-TERM: Deploy order history viewing and self-service quote requests (Phases 3-4) to enable customer self-service',
        'LONG-TERM: Implement advanced features like MFA, SSO, and digital proof approval (Phase 5) for enterprise readiness',
        'CRITICAL: Disable GraphQL Playground in production and implement rate limiting immediately',
        'ARCHITECTURE: Use separate subdomain (portal.agog.com) for customer portal vs. internal ERP (app.agog.com)',
        'SECURITY: Implement OWASP Top 10 mitigations from the start, not as an afterthought',
        'TESTING: Perform security testing (penetration testing) and load testing (100+ concurrent users) before production launch',
      ],

      nextSteps: [
        'Roy (Backend): Install authentication packages and create auth module structure (Phase 1 kickoff)',
        'Roy (Backend): Create customer_users table migration and CustomerAuthModule (Phase 2 preparation)',
        'Jen (Frontend): Design customer portal UI/UX mockups (login, dashboard, order history)',
        'Jen (Frontend): Set up separate React app for customer portal with routing structure',
        'Marcus (Project Lead): Review and approve recommended architecture (dual auth realms)',
        'Marcus (Project Lead): Prioritize phases based on business value and resource availability',
        'DevOps: Set up portal.agog.com subdomain and SSL certificate',
        'DevOps: Configure S3/Azure storage for artwork uploads with virus scanning',
        'Security: Review security requirements and schedule penetration testing post-Phase 5',
      ],

      businessImpact: [
        'Reduce manual order entry workload by 60-70% (customers self-enter data)',
        'Increase customer satisfaction with 24/7 self-service availability',
        'Improve order accuracy (eliminate transcription errors from phone/email orders)',
        'Accelerate quote-to-order conversion (instant approval and conversion)',
        'Enable business scalability without proportional headcount growth',
        'Competitive advantage in $34B web-to-print market',
        'Capture market share from competitors without customer portals',
        'Reduce CSR workload to focus on high-value customer interactions',
        'Improve cash flow with online payment and down payment collection',
        'Better data analytics on customer ordering patterns and preferences',
      ],

      references: [
        'https://www.yoprint.com/customer-self-service-portal-for-print-shops',
        'https://printepssw.com/insight/what-to-look-for-in-a-web-to-print-portal-features-benefits-and-best-practices',
        'https://ordant.com/creating-web-to-print-portals-for-your-customers/',
        'https://spp.co/blog/client-portal-security/',
        'https://www.zendesk.com/service/help-center/client-portal/',
        'https://www.crmjetty.com/blog/features-customer-portal/',
        'https://docs.nestjs.com/security/authentication',
        'https://medium.com/@camillefauchier/implementing-authentication-in-nestjs-using-passport-and-jwt-5a565aa521de',
        'https://astconsulting.in/java-script/nodejs/nestjs/nestjs-authentication-best-practices',
        'https://medium.com/@priyanshu011109/implementing-jwt-authentication-in-nestjs-the-secure-and-scalable-way-100a8f1472d9',
        'https://dev.to/drbenzene/best-security-implementation-practices-in-nestjs-a-comprehensive-guide-2p88',
        'https://www.prisma.io/blog/nestjs-prisma-authentication-7D056s1s0k3l',
      ],
    };

    // Publish to multiple NATS subjects for routing
    const subjects = [
      'agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767048328659',
      'agog.deliverables.research',
      'agog.requirements.REQ-STRATEGIC-AUTO-1767048328659.research-complete',
      'agog.strategic.customer-portal-self-service-ordering',
    ];

    const payload = JSON.stringify(deliverable, null, 2);

    for (const subject of subjects) {
      nc.publish(subject, sc.encode(payload));
      console.log(`📤 Published to: ${subject}`);
    }

    console.log('\n✅ DELIVERABLE PUBLISHED SUCCESSFULLY\n');
    console.log('📋 Summary:');
    console.log(`   Agent: Cynthia (Research Analyst)`);
    console.log(`   Requirement: ${REQ_NUMBER}`);
    console.log(`   Feature: ${FEATURE_TITLE}`);
    console.log(`   Status: COMPLETE`);
    console.log(`   Document: ${deliverablePath}`);
    console.log(`   Timestamp: ${deliverable.timestamp}`);
    console.log('\n🔍 Key Findings:');
    console.log(`   ✅ Strengths: ${deliverable.researchFindings.currentSystemAnalysis.strengths.length} identified`);
    console.log(`   ❌ Critical Gaps: ${deliverable.researchFindings.currentSystemAnalysis.criticalGaps.length} identified`);
    console.log(`   📚 Industry Best Practices: ${deliverable.researchFindings.industryBestPractices.coreSelfServiceFeatures.length} core features`);
    console.log(`   🏗️  Implementation Phases: 5 phases (10-12 weeks, 260-320 hours)`);
    console.log(`   🔒 Security: OWASP Top 10 mitigations + GDPR/PCI DSS/SOC 2 compliance`);
    console.log(`   💡 Recommendations: ${deliverable.recommendations.length} strategic recommendations`);
    console.log(`   📈 Business Impact: ${deliverable.businessImpact.length} expected benefits`);
    console.log('\n🎯 Next Steps for Team:');
    deliverable.nextSteps.slice(0, 3).forEach((step, idx) => {
      console.log(`   ${idx + 1}. ${step}`);
    });

    // Save JSON payload to file for reference
    const jsonPath = deliverablePath.replace('.md', '.json');
    fs.writeFileSync(jsonPath, payload, 'utf-8');
    console.log(`\n💾 JSON payload saved to: ${jsonPath}`);

    await nc.drain();
    console.log('\n🔌 NATS connection closed');
  } catch (error) {
    console.error('❌ Error publishing deliverable:', error);
    process.exit(1);
  } finally {
    if (nc) {
      await nc.close();
    }
  }
}

main();
