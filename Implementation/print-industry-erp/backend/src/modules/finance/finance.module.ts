/**
 * Finance Module
 *
 * Handles financial operations and accounting:
 * - Financial Periods (month-end close)
 * - Chart of Accounts (GL master)
 * - Exchange Rates (multi-currency)
 * - Journal Entries (GL postings)
 * - GL Balances (account balances by period)
 * - Invoices (AR/AP)
 * - Payments (AR/AP)
 * - Cost Allocations (job costing)
 * - Financial Reports (Trial Balance, P&L, Balance Sheet, AR/AP Aging)
 *
 * Related Resolver:
 * - FinanceResolver
 */

import { Module } from '@nestjs/common';
import { FinanceResolver } from '../../graphql/resolvers/finance.resolver';

@Module({
  providers: [FinanceResolver],
  exports: [],
})
export class FinanceModule {}
