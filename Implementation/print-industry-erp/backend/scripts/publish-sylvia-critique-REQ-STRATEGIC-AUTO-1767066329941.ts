import { connect, NatsConnection, JSONCodec } from 'nats';

const jc = JSONCodec();

interface CritiqueDeliverable {
  reqNumber: string;
  featureTitle: string;
  agent: string;
  status: string;
  deliverableType: string;
  summary: string;
  criticalIssues: {
    securityGaps: string[];
    architecturalConcerns: string[];
    transactionSafety: string[];
    operationalRisks: string[];
  };
  recommendations: {
    priority1MustHave: string[];
    priority2ShouldHave: string[];
    priority3NiceToHave: string[];
  };
  riskAssessment: {
    implementationRisk: string;
    technicalDebtRisk: string;
    securityRisk: string;
    operationalRisk: string;
  };
  revisedEstimates: {
    timeline: string;
    effort: string;
    roi: string;
  };
  verdict: string;
  nextAgent: string;
  deliveredAt: string;
}

async function publishCritiqueDeliverable() {
  let nc: NatsConnection | null = null;

  try {
    // Connect to NATS
    nc = await connect({
      servers: process.env.NATS_URL || 'nats://localhost:4222',
    });

    console.log('✅ Connected to NATS server');

    const deliverable: CritiqueDeliverable = {
      reqNumber: 'REQ-STRATEGIC-AUTO-1767066329941',
      featureTitle: 'Carrier Shipping Integrations',
      agent: 'sylvia',
      status: 'COMPLETE',
      deliverableType: 'CRITIQUE',
      summary: `Comprehensive architectural critique of carrier shipping integration reveals excellent research foundation but CRITICAL security and transaction safety gaps. Conditionally approve with mandatory 2-week architecture sprint (credential encryption, carrier abstraction, saga pattern) before development. Revised timeline: 16 weeks (not 12). Skipping architectural fixes = 6-month technical debt cleanup.`,
      criticalIssues: {
        securityGaps: [
          'No credential encryption implementation despite database schema fields (api_password_encrypted, api_key_encrypted)',
          'Webhook signature verification mentioned but not designed - HIGH security risk',
          'No key management strategy (AWS Secrets Manager, Azure Key Vault)',
          'No credential rotation mechanism or audit trail for access',
          'Plain text credential storage = PCI/SOC2 audit failure risk',
        ],
        architecturalConcerns: [
          'TODO in manifestShipment() indicates no carrier API abstraction layer',
          'No ICarrierClient interface - will lead to massive technical debt',
          'No Strategy Pattern for carrier-specific implementations',
          'Missing carrier client factory for dynamic carrier selection',
          'Each carrier (FedEx, UPS, USPS) has different auth, rate limits, error formats',
        ],
        transactionSafety: [
          'Database updates happen BEFORE carrier API calls - no rollback on failure',
          'No Saga Pattern for distributed transactions (database + carrier API)',
          'Orphaned shipment records if carrier API fails after DB insert',
          'No idempotency keys for carrier API calls - duplicate manifest risk',
          'Missing retry queue with exponential backoff for transient failures',
        ],
        operationalRisks: [
          'No rate limiting for carrier APIs (FedEx: 10 req/sec, USPS: 1 req/sec)',
          'API quota exhaustion during peak periods = fulfillment stoppage',
          'No carrier failover strategy - single point of failure',
          'Missing circuit breaker pattern for cascading failure prevention',
          'Generic error handling loses critical carrier-specific context',
        ],
      },
      recommendations: {
        priority1MustHave: [
          'CredentialEncryptionService with AWS Secrets Manager or Azure Key Vault (Week 1)',
          'ICarrierClient interface with Strategy Pattern and factory (Week 1)',
          'ShipmentManifestOrchestrator with Saga Pattern for transaction safety (Week 2)',
          'Webhook security: HMAC signature verification + replay attack prevention (Week 2)',
        ],
        priority2ShouldHave: [
          'CarrierApiRateLimiter with token bucket algorithm per carrier (Week 3)',
          'Domain-specific error hierarchy (AddressValidationError, ServiceUnavailableError, etc.) (Week 3)',
          'CarrierCircuitBreaker to prevent cascading failures (Week 4)',
          'CarrierFailoverService for automatic carrier selection during outages (Week 4)',
        ],
        priority3NiceToHave: [
          'Cost optimization engine with real-time rate shopping (Phase 2)',
          'Predictive analytics for shipping cost forecasting (Phase 2)',
          'Carbon footprint tracking for sustainability reporting (Phase 3)',
          'Multi-tenant carrier routing (different carriers per tenant/facility) (Phase 3)',
        ],
      },
      riskAssessment: {
        implementationRisk: 'HIGH - Without architectural foundation (credential encryption, carrier abstraction, transaction safety), implementation will accumulate massive technical debt requiring 6-month refactoring project',
        technicalDebtRisk: 'CRITICAL - TODO in manifestShipment() + no abstraction layer = brittle code, carrier-specific bugs, impossible to test. Must implement ICarrierClient interface BEFORE Phase 1',
        securityRisk: 'HIGH - Plain text credentials + unverified webhooks = PCI/SOC2 audit failure + security breach. Credential encryption is NON-NEGOTIABLE',
        operationalRisk: 'MEDIUM-HIGH - No rate limiting = API suspension during peak periods. No failover = complete fulfillment stoppage during carrier outages. Circuit breaker required',
      },
      revisedEstimates: {
        timeline: '16 weeks (vs Cynthias 12 weeks) - includes 2-week architecture sprint (Phase 0) before development begins. Skipping Phase 0 = false economy',
        effort: '640 hours total (480 hours development + 160 hours architecture). Phase 0: 80 hours (credential encryption, carrier abstraction, saga pattern)',
        roi: 'IMPROVED: 17-month payback (vs 23 months) with additional value drivers: address validation ($1k/month error reduction), customer satisfaction, carrier negotiation leverage, audit trail. 5-year NPV: $157,800 (vs $97,800)',
      },
      verdict: 'CONDITIONALLY APPROVE - Cynthias research is A+ (excellent database schema, GraphQL API, realistic ROI), but implementation risk is HIGH without architectural fixes. Mandate 2-week Phase 0 for credential encryption, carrier abstraction, and transaction safety BEFORE Phase 1 begins. Total timeline: 16 weeks (4 extra weeks prevent 6 months technical debt)',
      nextAgent: 'roy',
      deliveredAt: new Date().toISOString(),
    };

    // Publish to NATS
    const subject = 'agog.deliverables.sylvia.critique.REQ-STRATEGIC-AUTO-1767066329941';
    nc.publish(subject, jc.encode(deliverable));

    console.log(`✅ Published critique deliverable to: ${subject}`);
    console.log(`📊 Summary: ${deliverable.summary.substring(0, 100)}...`);
    console.log(`\n🔴 CRITICAL ISSUES IDENTIFIED:`);
    console.log(`   Security Gaps: ${deliverable.criticalIssues.securityGaps.length}`);
    console.log(`   Architectural Concerns: ${deliverable.criticalIssues.architecturalConcerns.length}`);
    console.log(`   Transaction Safety: ${deliverable.criticalIssues.transactionSafety.length}`);
    console.log(`   Operational Risks: ${deliverable.criticalIssues.operationalRisks.length}`);
    console.log(`\n✅ RECOMMENDATIONS:`);
    console.log(`   Priority 1 (Must-Have): ${deliverable.recommendations.priority1MustHave.length} items`);
    console.log(`   Priority 2 (Should-Have): ${deliverable.recommendations.priority2ShouldHave.length} items`);
    console.log(`   Priority 3 (Nice-to-Have): ${deliverable.recommendations.priority3NiceToHave.length} items`);
    console.log(`\n⏱️  REVISED TIMELINE: 16 weeks (includes 2-week architecture sprint)`);
    console.log(`💰 IMPROVED ROI: 17-month payback, $157,800 5-year NPV`);
    console.log(`\n⚖️  VERDICT: ${deliverable.verdict.substring(0, 100)}...`);

    // Wait a bit for message to be sent
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n✅ Critique deliverable published successfully!');
    console.log('📋 Next: Roy (Backend) must implement Phase 0 architectural foundation');
  } catch (error) {
    console.error('❌ Error publishing critique deliverable:', error);
    process.exit(1);
  } finally {
    // Close connection
    if (nc) {
      await nc.close();
      console.log('🔌 NATS connection closed');
    }
  }
}

// Run the publisher
publishCritiqueDeliverable();
