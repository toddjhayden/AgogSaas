/**
 * Finance Module
 * REQ-STRATEGIC-AUTO-1767066329940
 *
 * Handles financial operations and accounting with service layer architecture
 *
 * Services:
 * - JournalEntryService: GL posting with validation
 * - InvoiceService: AR/AP invoice management
 * - PaymentService: Payment processing and application
 * - CostAllocationService: Job costing (Phase 2)
 * - PeriodCloseService: Month-end close (Phase 3)
 *
 * Related Resolver:
 * - FinanceResolver
 */

import { Module } from '@nestjs/common';
import { FinanceResolver } from '../../graphql/resolvers/finance.resolver';
import { JournalEntryService } from './services/journal-entry.service';
import { InvoiceService } from './services/invoice.service';
import { PaymentService } from './services/payment.service';
import { CostAllocationService } from './services/cost-allocation.service';
import { PeriodCloseService } from './services/period-close.service';

@Module({
  providers: [
    // Services
    JournalEntryService,
    InvoiceService,
    PaymentService,
    CostAllocationService,
    PeriodCloseService,
    // Resolver
    FinanceResolver,
  ],
  exports: [
    JournalEntryService,
    InvoiceService,
    PaymentService,
    CostAllocationService,
    PeriodCloseService,
  ],
})
export class FinanceModule {}
