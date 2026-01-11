import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { InvoiceService } from '../../modules/finance/services/invoice.service';
import { PaymentService } from '../../modules/finance/services/payment.service';
import { JournalEntryService } from '../../modules/finance/services/journal-entry.service';
import { CostAllocationService } from '../../modules/finance/services/cost-allocation.service';
import { CacheService, CacheTTL } from '../../cache/services/cache.service';
import { CacheKeyService } from '../../cache/services/cache-key.service';
import { CacheInvalidationService } from '../../cache/services/cache-invalidation.service';
import { CreateInvoiceDto, UpdateInvoiceDto, VoidInvoiceDto } from '../../modules/finance/dto/invoice.dto';
import { CreatePaymentDto, ApplyPaymentDto } from '../../modules/finance/dto/payment.dto';
import type {
  CreateCostPoolInput,
  UpdateCostPoolInput,
  CreateCostDriverInput,
  UpdateCostDriverInput,
  CreateAllocationRuleInput,
  UpdateAllocationRuleInput,
  CreateDriverMeasurementInput,
  RunAllocationInput,
  CostPoolFilters,
  CostDriverFilters,
  AllocationRuleFilters,
  AllocationRunFilters,
  JobCostAllocationFilters,
  DriverMeasurementFilters,
} from '../../modules/finance/interfaces/cost-allocation.interface';

/**
 * Finance GraphQL Resolver
 *
 * Handles financial operations:
 * - Financial Periods (month-end close)
 * - Chart of Accounts (GL master)
 * - Exchange Rates (multi-currency)
 * - Journal Entries (GL postings)
 * - GL Balances (account balances by period)
 * - Invoices (AR/AP)
 * - Payments (AR/AP)
 * - Cost Allocations (job costing)
 * - Financial Reports (Trial Balance, P&L, Balance Sheet, AR/AP Aging)
 */

@Resolver('Finance')
export class FinanceResolver {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly journalEntryService: JournalEntryService,
    private readonly costAllocationService: CostAllocationService,
    private readonly cacheService: CacheService,
    private readonly cacheKeyService: CacheKeyService,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  // =====================================================
  // FINANCIAL PERIOD QUERIES
  // =====================================================

  @Query('financialPeriod')
  async getFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM financial_periods WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Financial period ${id} not found`);
    }

    return this.mapFinancialPeriodRow(result.rows[0]);
  }

  @Query('financialPeriods')
  async getFinancialPeriods(
    @Args('tenantId') tenantId: string,
    @Args('year') year?: number,
    @Args('status') status?: string,
    @Context() context?: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (year) {
      whereClause += ` AND period_year = $${paramIndex++}`;
      params.push(year);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const result = await this.db.query(
      `SELECT * FROM financial_periods
       WHERE ${whereClause}
       ORDER BY period_year DESC, period_month DESC`,
      params
    );

    return result.rows.map(this.mapFinancialPeriodRow);
  }

  @Query('currentPeriod')
  async getCurrentPeriod(@Args('tenantId') tenantId: string, @Context() context: any) {
    const key = this.cacheKeyService.currentPeriod(tenantId);

    return this.cacheService.wrap(
      key,
      async () => {
        const result = await this.db.query(
          `SELECT * FROM financial_periods
           WHERE tenant_id = $1 AND status = 'OPEN'
           ORDER BY period_year DESC, period_month DESC
           LIMIT 1`,
          [tenantId]
        );

        if (result.rows.length === 0) {
          throw new Error('No open financial period found');
        }

        return this.mapFinancialPeriodRow(result.rows[0]);
      },
      CacheTTL.DASHBOARD // 1 hour TTL
    );
  }

  // =====================================================
  // CHART OF ACCOUNTS QUERIES
  // =====================================================

  @Query('account')
  async getAccount(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM chart_of_accounts WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Account ${id} not found`);
    }

    return this.mapChartOfAccountsRow(result.rows[0]);
  }

  @Query('chartOfAccounts')
  async getChartOfAccounts(
    @Args('tenantId') tenantId: string,
    @Args('accountType') accountType?: string,
    @Args('activeOnly') activeOnly: boolean = true,
    @Context() context?: any
  ) {
    // Only cache if no filters are applied (full COA list)
    if (!accountType && activeOnly) {
      const key = this.cacheKeyService.chartOfAccounts(tenantId);
      return this.cacheService.wrap(
        key,
        async () => {
          const result = await this.db.query(
            `SELECT * FROM chart_of_accounts
             WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active = TRUE
             ORDER BY account_number`,
            [tenantId]
          );
          return result.rows.map(this.mapChartOfAccountsRow);
        },
        CacheTTL.STATIC // 24 hours TTL
      );
    }

    // Filtered queries bypass cache
    let whereClause = `tenant_id = $1 AND deleted_at IS NULL`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (accountType) {
      whereClause += ` AND account_type = $${paramIndex++}`;
      params.push(accountType);
    }

    if (activeOnly) {
      whereClause += ` AND is_active = TRUE`;
    }

    const result = await this.db.query(
      `SELECT * FROM chart_of_accounts
       WHERE ${whereClause}
       ORDER BY account_number`,
      params
    );

    return result.rows.map(this.mapChartOfAccountsRow);
  }

  // =====================================================
  // EXCHANGE RATE QUERIES
  // =====================================================

  @Query('exchangeRate')
  async getExchangeRate(
    @Args('fromCurrency') fromCurrency: string,
    @Args('toCurrency') toCurrency: string,
    @Args('rateDate') rateDate: string,
    @Context() context: any
  ) {
    const tenantId = context.req.user.tenantId;
    const key = this.cacheKeyService.exchangeRate(tenantId, fromCurrency, toCurrency, rateDate);

    return this.cacheService.wrap(
      key,
      async () => {
        const result = await this.db.query(
          `SELECT * FROM exchange_rates
           WHERE tenant_id = $1
           AND from_currency_code = $2
           AND to_currency_code = $3
           AND rate_date = $4
           ORDER BY updated_at DESC
           LIMIT 1`,
          [tenantId, fromCurrency, toCurrency, rateDate]
        );

        if (result.rows.length === 0) {
          throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency} on ${rateDate}`);
        }

        return this.mapExchangeRateRow(result.rows[0]);
      },
      CacheTTL.STATIC // 24 hours TTL
    );
  }

  @Query('exchangeRates')
  async getExchangeRates(
    @Args('tenantId') tenantId: string,
    @Args('fromCurrency') fromCurrency?: string,
    @Args('toCurrency') toCurrency?: string,
    @Args('startDate') startDate?: string,
    @Args('endDate') endDate?: string,
    @Context() context?: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (fromCurrency) {
      whereClause += ` AND from_currency_code = $${paramIndex++}`;
      params.push(fromCurrency);
    }

    if (toCurrency) {
      whereClause += ` AND to_currency_code = $${paramIndex++}`;
      params.push(toCurrency);
    }

    if (startDate) {
      whereClause += ` AND rate_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND rate_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM exchange_rates
       WHERE ${whereClause}
       ORDER BY rate_date DESC, from_currency_code, to_currency_code`,
      params
    );

    return result.rows.map(this.mapExchangeRateRow);
  }

  // =====================================================
  // JOURNAL ENTRY QUERIES
  // =====================================================

  @Query('journalEntry')
  async getJournalEntry(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM journal_entries WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Journal entry ${id} not found`);
    }

    return this.mapJournalEntryRow(result.rows[0]);
  }

  @Query('journalEntries')
  async getJournalEntries(
    @Args('tenantId') tenantId: string,
    @Args('facilityId') facilityId?: string,
    @Args('status') status?: string,
    @Args('startDate') startDate?: string,
    @Args('endDate') endDate?: string,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context?: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (facilityId) {
      whereClause += ` AND facility_id = $${paramIndex++}`;
      params.push(facilityId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND entry_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND entry_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM journal_entries
       WHERE ${whereClause}
       ORDER BY entry_date DESC, entry_number DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return result.rows.map(this.mapJournalEntryRow);
  }

  // =====================================================
  // GL BALANCE QUERIES
  // =====================================================

  @Query('glBalance')
  async getGLBalance(
    @Args('accountId') accountId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT * FROM gl_balances
       WHERE account_id = $1
       AND period_year = $2
       AND period_month = $3
       AND currency_code = $4`,
      [accountId, year, month, currencyCode]
    );

    if (result.rows.length === 0) {
      // Return zero balance if not found
      return {
        accountId,
        periodYear: year,
        periodMonth: month,
        currencyCode,
        beginningBalance: 0,
        debitAmount: 0,
        creditAmount: 0,
        netChange: 0,
        endingBalance: 0
      };
    }

    return this.mapGLBalanceRow(result.rows[0]);
  }

  @Query('glBalances')
  async getGLBalances(
    @Args('tenantId') tenantId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Args('accountType') accountType?: string,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context?: any
  ) {
    let whereClause = `b.tenant_id = $1 AND b.period_year = $2 AND b.period_month = $3 AND b.currency_code = $4`;
    const params: any[] = [tenantId, year, month, currencyCode];
    let paramIndex = 5;

    if (accountType) {
      whereClause += ` AND a.account_type = $${paramIndex++}`;
      params.push(accountType);
    }

    const result = await this.db.query(
      `SELECT b.*, a.account_number, a.account_name
       FROM gl_balances b
       INNER JOIN chart_of_accounts a ON a.id = b.account_id
       WHERE ${whereClause}
       ORDER BY a.account_number`,
      params
    );

    return result.rows.map(this.mapGLBalanceRow);
  }

  // =====================================================
  // INVOICE QUERIES
  // =====================================================

  @Query('invoice')
  async getInvoice(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM invoices WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Invoice ${id} not found`);
    }

    return this.mapInvoiceRow(result.rows[0]);
  }

  @Query('invoices')
  async getInvoices(
    @Args('tenantId') tenantId: string,
    @Args('invoiceType') invoiceType?: string,
    @Args('customerId') customerId?: string,
    @Args('vendorId') vendorId?: string,
    @Args('status') status?: string,
    @Args('startDate') startDate?: string,
    @Args('endDate') endDate?: string,
    @Args('limit') limit: number = 100,
    @Args('offset') offset: number = 0,
    @Context() context?: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (invoiceType) {
      whereClause += ` AND invoice_type = $${paramIndex++}`;
      params.push(invoiceType);
    }

    if (customerId) {
      whereClause += ` AND customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND invoice_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND invoice_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM invoices
       WHERE ${whereClause}
       ORDER BY invoice_date DESC, invoice_number DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return result.rows.map(this.mapInvoiceRow);
  }

  // =====================================================
  // PAYMENT QUERIES
  // =====================================================

  @Query('payment')
  async getPayment(@Args('id') id: string, @Context() context: any) {
    const result = await this.db.query(
      `SELECT * FROM payments WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Payment ${id} not found`);
    }

    return this.mapPaymentRow(result.rows[0]);
  }

  @Query('payments')
  async getPayments(
    @Args('tenantId') tenantId: string,
    @Args('paymentType') paymentType?: string,
    @Args('customerId') customerId?: string,
    @Args('vendorId') vendorId?: string,
    @Args('startDate') startDate?: string,
    @Args('endDate') endDate?: string,
    @Context() context?: any
  ) {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (paymentType) {
      whereClause += ` AND payment_type = $${paramIndex++}`;
      params.push(paymentType);
    }

    if (customerId) {
      whereClause += ` AND customer_id = $${paramIndex++}`;
      params.push(customerId);
    }

    if (vendorId) {
      whereClause += ` AND vendor_id = $${paramIndex++}`;
      params.push(vendorId);
    }

    if (startDate) {
      whereClause += ` AND payment_date >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND payment_date <= $${paramIndex++}`;
      params.push(endDate);
    }

    const result = await this.db.query(
      `SELECT * FROM payments
       WHERE ${whereClause}
       ORDER BY payment_date DESC, payment_number DESC`,
      params
    );

    return result.rows.map(this.mapPaymentRow);
  }

  // =====================================================
  // COST ALLOCATION ENGINE QUERIES
  // REQ-1767541724200-2fb1a: Cost Allocation Engine
  // =====================================================

  @Query('costPool')
  async getCostPool(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req?.user?.tenantId || 'default';
    const result = await this.costAllocationService.getCostPool(id, tenantId);
    if (!result.success || !result.costPool) {
      throw new Error(result.error || 'Cost pool not found');
    }
    return this.mapCostPoolRow(result.costPool);
  }

  @Query('costPools')
  async getCostPools(
    @Args('tenantId') tenantId: string,
    @Args('poolType') poolType?: string,
    @Args('isActive') isActive?: boolean,
    @Args('periodYear') periodYear?: number,
    @Args('periodMonth') periodMonth?: number,
    @Context() context?: any
  ) {
    const filters: CostPoolFilters = {
      tenantId,
      poolType: poolType as any,
      isActive,
      periodYear,
      periodMonth,
    };
    const result = await this.costAllocationService.listCostPools(filters);
    return result.costPools.map(this.mapCostPoolRow);
  }

  @Query('costDriver')
  async getCostDriver(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req?.user?.tenantId || 'default';
    const result = await this.costAllocationService.getCostDriver(id, tenantId);
    if (!result.success || !result.costDriver) {
      throw new Error(result.error || 'Cost driver not found');
    }
    return this.mapCostDriverRow(result.costDriver);
  }

  @Query('costDrivers')
  async getCostDrivers(
    @Args('tenantId') tenantId: string,
    @Args('driverType') driverType?: string,
    @Args('isActive') isActive?: boolean,
    @Context() context?: any
  ) {
    const filters: CostDriverFilters = {
      tenantId,
      driverType: driverType as any,
      isActive,
    };
    const result = await this.costAllocationService.listCostDrivers(filters);
    return result.costDrivers.map(this.mapCostDriverRow);
  }

  @Query('allocationRule')
  async getAllocationRule(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req?.user?.tenantId || 'default';
    const result = await this.costAllocationService.getAllocationRule(id, tenantId);
    if (!result.success || !result.allocationRule) {
      throw new Error(result.error || 'Allocation rule not found');
    }
    return this.mapAllocationRuleRow(result.allocationRule);
  }

  @Query('allocationRules')
  async getAllocationRules(
    @Args('tenantId') tenantId: string,
    @Args('costPoolId') costPoolId?: string,
    @Args('costDriverId') costDriverId?: string,
    @Args('isActive') isActive?: boolean,
    @Args('effectiveDate') effectiveDate?: Date,
    @Context() context?: any
  ) {
    const filters: AllocationRuleFilters = {
      tenantId,
      costPoolId,
      costDriverId,
      isActive,
      effectiveDate,
    };
    const result = await this.costAllocationService.listAllocationRules(filters);
    return result.allocationRules.map(this.mapAllocationRuleRow);
  }

  @Query('allocationRun')
  async getAllocationRun(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req?.user?.tenantId || 'default';
    const result = await this.costAllocationService.getAllocationRun(id, tenantId);
    if (!result.success || !result.allocationRun) {
      throw new Error(result.error || 'Allocation run not found');
    }
    return this.mapAllocationRunRow(result.allocationRun);
  }

  @Query('allocationRuns')
  async getAllocationRuns(
    @Args('tenantId') tenantId: string,
    @Args('periodYear') periodYear?: number,
    @Args('periodMonth') periodMonth?: number,
    @Args('status') status?: string,
    @Args('fromDate') fromDate?: Date,
    @Args('toDate') toDate?: Date,
    @Context() context?: any
  ) {
    const filters: AllocationRunFilters = {
      tenantId,
      periodYear,
      periodMonth,
      status: status as any,
      fromDate,
      toDate,
    };
    const result = await this.costAllocationService.listAllocationRuns(filters);
    return result.allocationRuns.map(this.mapAllocationRunRow);
  }

  @Query('jobCostAllocations')
  async getJobCostAllocations(
    @Args('tenantId') tenantId: string,
    @Args('jobId') jobId?: string,
    @Args('jobCostId') jobCostId?: string,
    @Args('allocationRunId') allocationRunId?: string,
    @Args('costPoolId') costPoolId?: string,
    @Args('periodYear') periodYear?: number,
    @Args('periodMonth') periodMonth?: number,
    @Context() context?: any
  ) {
    const filters: JobCostAllocationFilters = {
      tenantId,
      jobId,
      jobCostId,
      allocationRunId,
      costPoolId,
      periodYear,
      periodMonth,
    };
    const result = await this.costAllocationService.listJobCostAllocations(filters);
    return result.allocations.map(this.mapJobCostAllocationRow);
  }

  @Query('driverMeasurement')
  async getDriverMeasurement(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.getDriverMeasurement(id, tenantId);
    if (!result.success || !result.driverMeasurement) {
      throw new Error(result.error || 'Driver measurement not found');
    }
    return this.mapDriverMeasurementRow(result.driverMeasurement);
  }

  @Query('driverMeasurements')
  async getDriverMeasurements(
    @Args('tenantId') tenantId: string,
    @Args('jobId') jobId?: string,
    @Args('costDriverId') costDriverId?: string,
    @Args('periodYear') periodYear?: number,
    @Args('periodMonth') periodMonth?: number,
    @Args('measurementSource') measurementSource?: string,
    @Context() context?: any
  ) {
    const filters: DriverMeasurementFilters = {
      tenantId,
      jobId,
      costDriverId,
      periodYear,
      periodMonth,
      measurementSource: measurementSource as any,
    };
    const result = await this.costAllocationService.listDriverMeasurements(filters);
    return result.measurements.map(this.mapDriverMeasurementRow);
  }

  @Query('allocationSummary')
  async getAllocationSummary(
    @Args('tenantId') tenantId: string,
    @Args('jobId') jobId: string,
    @Args('periodYear') periodYear: number,
    @Args('periodMonth') periodMonth: number,
    @Context() context: any
  ) {
    const summary = await this.costAllocationService.getAllocationSummary(
      tenantId,
      jobId,
      periodYear,
      periodMonth
    );
    return summary ? this.mapAllocationSummaryRow(summary) : null;
  }

  // =====================================================
  // FINANCIAL REPORTS
  // =====================================================

  @Query('trialBalance')
  async getTrialBalance(
    @Args('tenantId') tenantId: string,
    @Args('year') year: number,
    @Args('month') month: number,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT
        a.account_number,
        a.account_name,
        a.account_type,
        COALESCE(SUM(CASE WHEN a.normal_balance = 'DEBIT' THEN b.ending_balance ELSE 0 END), 0) as debit_amount,
        COALESCE(SUM(CASE WHEN a.normal_balance = 'CREDIT' THEN b.ending_balance ELSE 0 END), 0) as credit_amount
       FROM chart_of_accounts a
       LEFT JOIN gl_balances b ON b.account_id = a.id
         AND b.period_year = $2
         AND b.period_month = $3
         AND b.currency_code = $4
       WHERE a.tenant_id = $1
       AND a.is_active = TRUE
       AND a.is_header = FALSE
       AND a.deleted_at IS NULL
       GROUP BY a.account_number, a.account_name, a.account_type
       ORDER BY a.account_number`,
      [tenantId, year, month, currencyCode]
    );

    return result.rows.map(row => ({
      accountNumber: row.account_number,
      accountName: row.account_name,
      accountType: row.account_type,
      debitAmount: parseFloat(row.debit_amount),
      creditAmount: parseFloat(row.credit_amount)
    }));
  }

  @Query('profitAndLoss')
  async getProfitAndLoss(
    @Args('tenantId') tenantId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context: any
  ) {
    // TODO: Implement full P&L report with period-to-period calculations
    // For now, return placeholder structure

    const result = await this.db.query(
      `SELECT
        a.account_type as section,
        a.account_number,
        a.account_name,
        COALESCE(SUM(l.credit_amount - l.debit_amount), 0) as amount
       FROM chart_of_accounts a
       LEFT JOIN journal_entry_lines l ON l.account_id = a.id
       LEFT JOIN journal_entries j ON j.id = l.journal_entry_id
         AND j.status = 'POSTED'
         AND j.entry_date >= $2
         AND j.entry_date <= $3
       WHERE a.tenant_id = $1
       AND a.account_type IN ('REVENUE', 'EXPENSE', 'COST_OF_GOODS_SOLD')
       AND a.is_header = FALSE
       AND a.deleted_at IS NULL
       GROUP BY a.account_type, a.account_number, a.account_name
       ORDER BY a.account_type, a.account_number`,
      [tenantId, startDate, endDate]
    );

    return result.rows.map(row => ({
      section: row.section,
      accountNumber: row.account_number,
      accountName: row.account_name,
      amount: parseFloat(row.amount),
      percentOfRevenue: null // TODO: Calculate percentage
    }));
  }

  @Query('balanceSheet')
  async getBalanceSheet(
    @Args('tenantId') tenantId: string,
    @Args('asOfDate') asOfDate: string,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context: any
  ) {
    // TODO: Implement full balance sheet with cumulative balances
    // For now, return placeholder structure

    const result = await this.db.query(
      `SELECT
        a.account_type as section,
        a.account_number,
        a.account_name,
        COALESCE(SUM(b.ending_balance), 0) as amount
       FROM chart_of_accounts a
       LEFT JOIN gl_balances b ON b.account_id = a.id
         AND b.currency_code = $3
       WHERE a.tenant_id = $1
       AND a.account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
       AND a.is_header = FALSE
       AND a.deleted_at IS NULL
       GROUP BY a.account_type, a.account_number, a.account_name
       ORDER BY a.account_type, a.account_number`,
      [tenantId, asOfDate, currencyCode]
    );

    return result.rows.map(row => ({
      section: row.section,
      accountNumber: row.account_number,
      accountName: row.account_name,
      amount: parseFloat(row.amount),
      percentOfAssets: null // TODO: Calculate percentage
    }));
  }

  @Query('arAging')
  async getARAging(
    @Args('tenantId') tenantId: string,
    @Args('asOfDate') asOfDate: string,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT
        i.customer_id,
        c.customer_name,
        SUM(CASE WHEN $2::date - i.due_date <= 0 THEN i.balance_due ELSE 0 END) as current,
        SUM(CASE WHEN $2::date - i.due_date BETWEEN 1 AND 30 THEN i.balance_due ELSE 0 END) as days30,
        SUM(CASE WHEN $2::date - i.due_date BETWEEN 31 AND 60 THEN i.balance_due ELSE 0 END) as days60,
        SUM(CASE WHEN $2::date - i.due_date BETWEEN 61 AND 90 THEN i.balance_due ELSE 0 END) as days90,
        SUM(CASE WHEN $2::date - i.due_date > 90 THEN i.balance_due ELSE 0 END) as over90,
        SUM(i.balance_due) as total_due
       FROM invoices i
       INNER JOIN customers c ON c.id = i.customer_id
       WHERE i.tenant_id = $1
       AND i.invoice_type = 'CUSTOMER_INVOICE'
       AND i.balance_due > 0
       AND i.currency_code = $3
              GROUP BY i.customer_id, c.customer_name
       ORDER BY total_due DESC`,
      [tenantId, asOfDate, currencyCode]
    );

    return result.rows.map(row => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      current: parseFloat(row.current),
      days30: parseFloat(row.days30),
      days60: parseFloat(row.days60),
      days90: parseFloat(row.days90),
      over90: parseFloat(row.over90),
      totalDue: parseFloat(row.total_due)
    }));
  }

  @Query('apAging')
  async getAPAging(
    @Args('tenantId') tenantId: string,
    @Args('asOfDate') asOfDate: string,
    @Args('currencyCode') currencyCode: string = 'USD',
    @Context() context: any
  ) {
    const result = await this.db.query(
      `SELECT
        i.vendor_id,
        v.vendor_name,
        SUM(CASE WHEN $2::date - i.due_date <= 0 THEN i.balance_due ELSE 0 END) as current,
        SUM(CASE WHEN $2::date - i.due_date BETWEEN 1 AND 30 THEN i.balance_due ELSE 0 END) as days30,
        SUM(CASE WHEN $2::date - i.due_date BETWEEN 31 AND 60 THEN i.balance_due ELSE 0 END) as days60,
        SUM(CASE WHEN $2::date - i.due_date BETWEEN 61 AND 90 THEN i.balance_due ELSE 0 END) as days90,
        SUM(CASE WHEN $2::date - i.due_date > 90 THEN i.balance_due ELSE 0 END) as over90,
        SUM(i.balance_due) as total_due
       FROM invoices i
       INNER JOIN vendors v ON v.id = i.vendor_id
       WHERE i.tenant_id = $1
       AND i.invoice_type = 'VENDOR_INVOICE'
       AND i.balance_due > 0
       AND i.currency_code = $3
              GROUP BY i.vendor_id, v.vendor_name
       ORDER BY total_due DESC`,
      [tenantId, asOfDate, currencyCode]
    );

    return result.rows.map(row => ({
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      current: parseFloat(row.current),
      days30: parseFloat(row.days30),
      days60: parseFloat(row.days60),
      days90: parseFloat(row.days90),
      over90: parseFloat(row.over90),
      totalDue: parseFloat(row.total_due)
    }));
  }

  // =====================================================
  // MUTATIONS - FINANCIAL PERIOD
  // =====================================================

  @Mutation('createFinancialPeriod')
  async createFinancialPeriod(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO financial_periods (
        tenant_id, period_year, period_month,
        period_start_date, period_end_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        tenantId,
        input.periodYear,
        input.periodMonth,
        input.periodStartDate,
        input.periodEndDate,
        userId
      ]
    );

    return this.mapFinancialPeriodRow(result.rows[0]);
  }

  @Mutation('closeFinancialPeriod')
  async closeFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE financial_periods
       SET status = 'CLOSED',
           closed_by_user_id = $1,
           closed_at = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Financial period ${id} not found`);
    }

    // TODO: Run month-end close procedures (update GL balances, etc.)

    return this.mapFinancialPeriodRow(result.rows[0]);
  }

  @Mutation('reopenFinancialPeriod')
  async reopenFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const result = await this.db.query(
      `UPDATE financial_periods
       SET status = 'OPEN',
           closed_by_user_id = NULL,
           closed_at = NULL,
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Financial period ${id} not found`);
    }

    return this.mapFinancialPeriodRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - CHART OF ACCOUNTS
  // =====================================================

  @Mutation('createAccount')
  async createAccount(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO chart_of_accounts (
        tenant_id, account_number, account_name, description,
        account_type, account_subtype, parent_account_id,
        normal_balance, functional_currency_code, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        tenantId,
        input.accountNumber,
        input.accountName,
        input.description,
        input.accountType,
        input.accountSubtype,
        input.parentAccountId,
        input.normalBalance,
        input.functionalCurrencyCode || 'USD',
        userId
      ]
    );

    // Invalidate Chart of Accounts cache
    await this.cacheInvalidationService.handleEvent({
      eventType: 'ACCOUNT_CREATED',
      tenantId,
      entityId: result.rows[0].id,
    });

    return this.mapChartOfAccountsRow(result.rows[0]);
  }

  @Mutation('updateAccount')
  async updateAccount(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.accountName !== undefined) {
      updates.push(`account_name = $${paramIndex++}`);
      values.push(input.accountName);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.isActive);
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
    values.push(id);

    const result = await this.db.query(
      `UPDATE chart_of_accounts SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error(`Account ${id} not found`);
    }

    // Invalidate Chart of Accounts cache
    await this.cacheInvalidationService.handleEvent({
      eventType: 'ACCOUNT_UPDATED',
      tenantId,
      entityId: id,
    });

    return this.mapChartOfAccountsRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - EXCHANGE RATE
  // =====================================================

  @Mutation('createExchangeRate')
  async createExchangeRate(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const result = await this.db.query(
      `INSERT INTO exchange_rates (
        tenant_id, from_currency_code, to_currency_code, rate_date,
        exchange_rate, rate_type, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        tenantId,
        input.fromCurrencyCode,
        input.toCurrencyCode,
        input.rateDate,
        input.exchangeRate,
        input.rateType,
        userId
      ]
    );

    return this.mapExchangeRateRow(result.rows[0]);
  }

  // =====================================================
  // MUTATIONS - JOURNAL ENTRY
  // =====================================================

  @Mutation('createJournalEntry')
  async createJournalEntry(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Generate journal entry number
      const jeNumber = `JE-${Date.now()}`;

      // Determine period from posting date
      const postingDate = new Date(input.postingDate);
      const periodYear = postingDate.getFullYear();
      const periodMonth = postingDate.getMonth() + 1;

      // Create journal entry header
      const headerResult = await client.query(
        `INSERT INTO journal_entries (
          tenant_id, facility_id, entry_number, entry_type,
          entry_date, posting_date, period_year, period_month,
          description, reference, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'DRAFT', $11)
        RETURNING *`,
        [
          tenantId,
          input.facilityId,
          jeNumber,
          input.entryType,
          input.entryDate,
          input.postingDate,
          periodYear,
          periodMonth,
          input.description,
          input.reference,
          userId
        ]
      );

      const journalEntryId = headerResult.rows[0].id;

      // Create journal entry lines
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        await client.query(
          `INSERT INTO journal_entry_lines (
            tenant_id, journal_entry_id, line_number, account_id,
            debit_amount, credit_amount, foreign_currency_code,
            foreign_currency_amount, exchange_rate, line_description, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            tenantId,
            journalEntryId,
            i + 1,
            line.accountId,
            line.debitAmount,
            line.creditAmount,
            line.foreignCurrencyCode,
            line.foreignCurrencyAmount,
            line.exchangeRate,
            line.lineDescription,
            userId
          ]
        );
      }

      await client.query('COMMIT');

      return this.mapJournalEntryRow(headerResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  @Mutation('postJournalEntry')
  async postJournalEntry(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    // TODO: Validate debits = credits before posting
    // TODO: Update GL balances

    const result = await this.db.query(
      `UPDATE journal_entries
       SET status = 'POSTED',
           posted_by = $1,
           posted_at = NOW(),
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Journal entry ${id} not found`);
    }

    return this.mapJournalEntryRow(result.rows[0]);
  }

  @Mutation('reverseJournalEntry')
  async reverseJournalEntry(
    @Args('id') id: string,
    @Args('reversalDate') reversalDate?: string,
    @Context() context?: any
  ) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // TODO: Create reversing journal entry with opposite signs

    throw new Error('Not yet implemented');
  }

  // =====================================================
  // MUTATIONS - INVOICE (Simplified stubs - full implementation needed)
  // =====================================================

  @Mutation('createInvoice')
  async createInvoice(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    // Calculate totals from lines
    const subtotal = input.lines.reduce((sum: number, line: { lineAmount: number }) => sum + line.lineAmount, 0);
    const taxAmount = input.lines.reduce((sum: number, line: { taxAmount?: number }) => sum + (line.taxAmount || 0), 0);
    const totalAmount = subtotal + taxAmount;

    // Map GraphQL input to service DTO
    const dto: CreateInvoiceDto = {
      tenantId,
      facilityId: input.facilityId,
      invoiceType: input.invoiceType,
      customerId: input.customerId,
      vendorId: input.vendorId,
      invoiceNumber: undefined, // Auto-generate
      invoiceDate: new Date(input.invoiceDate),
      dueDate: new Date(input.dueDate),
      currencyCode: input.currencyCode,
      exchangeRate: undefined, // Auto-lookup
      lines: input.lines.map((line: {
        description: string;
        quantity?: number;
        unitPrice: number;
        lineAmount: number;
        revenueAccountId: string;
        taxAmount?: number;
      }) => ({
        description: line.description,
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice,
        amount: line.lineAmount,
        accountId: line.revenueAccountId,
        taxAmount: line.taxAmount || 0,
        discountAmount: 0,
      })),
      subtotal,
      taxAmount,
      shippingAmount: 0,
      discountAmount: 0,
      totalAmount,
      notes: input.notes,
      referenceNumber: input.purchaseOrderNumber,
      postToGL: true, // Always post to GL
    };

    // Call service
    const invoice = await this.invoiceService.createInvoice(dto, userId);

    // Return GraphQL type
    return this.mapInvoiceRow(invoice);
  }

  @Mutation('updateInvoice')
  async updateInvoice(
    @Args('id') id: string,
    @Args('input') input: any,
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    const dto: UpdateInvoiceDto = {
      invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      notes: input.notes,
      referenceNumber: input.referenceNumber,
    };

    const invoice = await this.invoiceService.updateInvoice(id, dto, userId);
    return this.mapInvoiceRow(invoice);
  }

  @Mutation('voidInvoice')
  async voidInvoice(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;

    const dto: VoidInvoiceDto = {
      reason: 'Voided via GraphQL',
      voidDate: new Date(),
      reverseGL: true, // Always reverse GL on void
    };

    const invoice = await this.invoiceService.voidInvoice(id, dto, userId);
    return this.mapInvoiceRow(invoice);
  }

  // =====================================================
  // MUTATIONS - PAYMENT (Simplified stubs)
  // =====================================================

  @Mutation('createPayment')
  async createPayment(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    const dto: CreatePaymentDto = {
      tenantId,
      facilityId: input.facilityId,
      paymentType: input.paymentType,
      customerId: input.customerId,
      vendorId: input.vendorId,
      paymentNumber: undefined, // Auto-generate
      paymentDate: new Date(input.paymentDate),
      depositDate: input.depositDate ? new Date(input.depositDate) : undefined,
      amount: input.paymentAmount,
      currencyCode: input.currencyCode,
      exchangeRate: undefined, // Auto-lookup
      paymentMethod: input.paymentMethod,
      checkNumber: input.checkNumber,
      transactionId: input.transactionId,
      paidByName: input.paidByName,
      bankAccountId: input.bankAccountId,
      applyToInvoices: [], // Will handle in separate mutation
      notes: input.notes,
      referenceNumber: input.referenceNumber,
      postToGL: true, // Always post to GL
    };

    const payment = await this.paymentService.createPayment(dto, userId);
    return this.mapPaymentRow(payment);
  }

  @Mutation('applyPayment')
  async applyPayment(
    @Args('paymentId') paymentId: string,
    @Args('applications') applications: any[],
    @Context() context: any
  ) {
    const userId = context.req.user.id;

    // Apply each invoice application
    for (const app of applications) {
      const dto: ApplyPaymentDto = {
        paymentId,
        invoiceId: app.invoiceId,
        amountToApply: app.amountApplied,
        appliedDate: new Date(),
      };

      await this.paymentService.applyPayment(dto, userId);
    }

    // Return updated payment
    const paymentResult = await this.db.query(
      `SELECT * FROM payments WHERE id = $1`,
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      throw new Error(`Payment ${paymentId} not found`);
    }

    return this.mapPaymentRow(paymentResult.rows[0]);
  }

  // =====================================================
  // MUTATIONS - COST ALLOCATION ENGINE
  // REQ-1767541724200-2fb1a: Cost Allocation Engine
  // =====================================================

  @Mutation('createCostPool')
  async createCostPool(@Args('input') input: CreateCostPoolInput, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.createCostPool(tenantId, input);
    if (!result.success || !result.costPool) {
      throw new Error(result.error || 'Failed to create cost pool');
    }
    return this.mapCostPoolRow(result.costPool);
  }

  @Mutation('updateCostPool')
  async updateCostPool(
    @Args('id') id: string,
    @Args('input') input: UpdateCostPoolInput,
    @Context() context: any
  ) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.updateCostPool(id, tenantId, input);
    if (!result.success || !result.costPool) {
      throw new Error(result.error || 'Failed to update cost pool');
    }
    return this.mapCostPoolRow(result.costPool);
  }

  @Mutation('deleteCostPool')
  async deleteCostPool(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.deleteCostPool(id, tenantId);
    return result.success;
  }

  @Mutation('createCostDriver')
  async createCostDriver(@Args('input') input: CreateCostDriverInput, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.createCostDriver(tenantId, input);
    if (!result.success || !result.costDriver) {
      throw new Error(result.error || 'Failed to create cost driver');
    }
    return this.mapCostDriverRow(result.costDriver);
  }

  @Mutation('updateCostDriver')
  async updateCostDriver(
    @Args('id') id: string,
    @Args('input') input: UpdateCostDriverInput,
    @Context() context: any
  ) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.updateCostDriver(id, tenantId, input);
    if (!result.success || !result.costDriver) {
      throw new Error(result.error || 'Failed to update cost driver');
    }
    return this.mapCostDriverRow(result.costDriver);
  }

  @Mutation('deleteCostDriver')
  async deleteCostDriver(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.deleteCostDriver(id, tenantId);
    return result.success;
  }

  @Mutation('createAllocationRule')
  async createAllocationRule(@Args('input') input: CreateAllocationRuleInput, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.createAllocationRule(tenantId, input);
    if (!result.success || !result.allocationRule) {
      throw new Error(result.error || 'Failed to create allocation rule');
    }
    return this.mapAllocationRuleRow(result.allocationRule);
  }

  @Mutation('updateAllocationRule')
  async updateAllocationRule(
    @Args('id') id: string,
    @Args('input') input: UpdateAllocationRuleInput,
    @Context() context: any
  ) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.updateAllocationRule(id, tenantId, input);
    if (!result.success || !result.allocationRule) {
      throw new Error(result.error || 'Failed to update allocation rule');
    }
    return this.mapAllocationRuleRow(result.allocationRule);
  }

  @Mutation('deleteAllocationRule')
  async deleteAllocationRule(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.deleteAllocationRule(id, tenantId);
    return result.success;
  }

  @Mutation('createDriverMeasurement')
  async createDriverMeasurement(@Args('input') input: CreateDriverMeasurementInput, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.createDriverMeasurement(tenantId, input);
    if (!result.success || !result.driverMeasurement) {
      throw new Error(result.error || 'Failed to create driver measurement');
    }
    return this.mapDriverMeasurementRow(result.driverMeasurement);
  }

  @Mutation('runAllocation')
  async runAllocation(@Args('input') input: RunAllocationInput, @Context() context: any) {
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.runAllocation(tenantId, input);
    if (!result.success || !result.allocationRun) {
      throw new Error(result.error || 'Failed to run allocation');
    }
    return this.mapAllocationRunRow(result.allocationRun);
  }

  @Mutation('reverseAllocationRun')
  async reverseAllocationRun(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.userId;
    const tenantId = context.req.tenantId;
    const result = await this.costAllocationService.reverseAllocationRun(id, userId, tenantId);
    if (!result.success || !result.allocationRun) {
      throw new Error(result.error || 'Failed to reverse allocation run');
    }
    return this.mapAllocationRunRow(result.allocationRun);
  }

  // =====================================================
  // MAPPERS
  // =====================================================

  private mapFinancialPeriodRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      periodName: row.period_name,
      periodStartDate: row.period_start_date,
      periodEndDate: row.period_end_date,
      status: row.status,
      closedByUserId: row.closed_by_user_id,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapChartOfAccountsRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accountNumber: row.account_number,
      accountName: row.account_name,
      description: row.description,
      accountType: row.account_type,
      accountSubtype: row.account_subtype,
      parentAccountId: row.parent_account_id,
      accountLevel: row.account_level,
      isHeader: row.is_header,
      balanceSheetSection: row.balance_sheet_section,
      incomeStatementSection: row.income_statement_section,
      normalBalance: row.normal_balance,
      functionalCurrencyCode: row.functional_currency_code,
      allowForeignCurrency: row.allow_foreign_currency,
      allowManualEntry: row.allow_manual_entry,
      requiresDepartment: row.requires_department,
      requiresProject: row.requires_project,
      isActive: row.is_active,
      dateOpened: row.date_opened,
      dateClosed: row.date_closed,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapExchangeRateRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fromCurrencyCode: row.from_currency_code,
      toCurrencyCode: row.to_currency_code,
      rateDate: row.rate_date,
      exchangeRate: row.exchange_rate,
      rateType: row.rate_type,
      rateSource: row.rate_source,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapJournalEntryRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      journalEntryNumber: row.entry_number,
      entryType: row.entry_type,
      entryDate: row.entry_date,
      postingDate: row.posting_date,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      sourceModule: row.source_module,
      sourceDocumentId: row.source_document_id,
      sourceDocumentNumber: row.source_document_number,
      description: row.description,
      reference: row.reference,
      status: row.status,
      postedBy: row.posted_by,
      postedAt: row.posted_at,
      reversalOfEntryId: row.reversal_of_entry_id,
      reversedByEntryId: row.reversed_by_entry_id,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapGLBalanceRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      currencyCode: row.currency_code,
      beginningBalance: row.beginning_balance,
      debitAmount: row.debit_amount,
      creditAmount: row.credit_amount,
      netChange: row.net_change,
      endingBalance: row.ending_balance,
      updatedAt: row.updated_at
    };
  }

  private mapInvoiceRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      invoiceNumber: row.invoice_number,
      invoiceType: row.invoice_type,
      customerId: row.customer_id,
      vendorId: row.vendor_id,
      billToName: row.bill_to_name,
      billToAddressLine1: row.bill_to_address_line1,
      billToCity: row.bill_to_city,
      billToPostalCode: row.bill_to_postal_code,
      billToCountry: row.bill_to_country,
      invoiceDate: row.invoice_date,
      dueDate: row.due_date,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      currencyCode: row.currency_code,
      exchangeRate: row.exchange_rate,
      subtotal: row.subtotal_amount,
      taxAmount: row.tax_amount,
      shippingAmount: row.shipping_amount,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
      balanceDue: row.balance_due,
      status: row.status,
      paymentStatus: row.payment_status,
      paymentTerms: row.payment_terms,
      discountTerms: row.discount_terms,
      purchaseOrderNumber: row.purchase_order_number,
      salesOrderId: row.sales_order_id,
      shipmentId: row.shipment_id,
      journalEntryId: row.journal_entry_id,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapPaymentRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      paymentNumber: row.payment_number,
      paymentType: row.payment_type,
      customerId: row.customer_id,
      vendorId: row.vendor_id,
      paidByName: row.paid_by_name,
      paymentDate: row.payment_date,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      currencyCode: row.currency_code,
      exchangeRate: row.exchange_rate,
      paymentAmount: row.payment_amount,
      paymentMethod: row.payment_method,
      referenceNumber: row.reference_number,
      checkNumber: row.check_number,
      transactionId: row.transaction_id,
      bankAccountId: row.bank_account_id,
      depositDate: row.deposit_date,
      status: row.status,
      journalEntryId: row.journal_entry_id,
      notes: row.notes,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  // =====================================================
  // COST ALLOCATION ENGINE MAPPERS
  // REQ-1767541724200-2fb1a: Cost Allocation Engine
  // =====================================================

  private mapCostPoolRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      poolCode: row.poolCode || row.pool_code,
      poolName: row.poolName || row.pool_name,
      description: row.description,
      poolType: row.poolType || row.pool_type,
      costBehavior: row.costBehavior || row.cost_behavior,
      sourceAccountId: row.sourceAccountId || row.source_account_id,
      currentPoolAmount: row.currentPoolAmount || row.current_pool_amount,
      periodYear: row.periodYear || row.period_year,
      periodMonth: row.periodMonth || row.period_month,
      isActive: row.isActive ?? row.is_active,
      createdAt: row.createdAt || row.created_at,
      createdBy: row.createdBy || row.created_by,
      updatedAt: row.updatedAt || row.updated_at,
      updatedBy: row.updatedBy || row.updated_by,
    };
  }

  private mapCostDriverRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      driverCode: row.driverCode || row.driver_code,
      driverName: row.driverName || row.driver_name,
      description: row.description,
      driverType: row.driverType || row.driver_type,
      unitOfMeasure: row.unitOfMeasure || row.unit_of_measure,
      calculationMethod: row.calculationMethod || row.calculation_method,
      sourceTable: row.sourceTable || row.source_table,
      sourceColumn: row.sourceColumn || row.source_column,
      sourceQuery: row.sourceQuery || row.source_query,
      isActive: row.isActive ?? row.is_active,
      createdAt: row.createdAt || row.created_at,
      createdBy: row.createdBy || row.created_by,
      updatedAt: row.updatedAt || row.updated_at,
      updatedBy: row.updatedBy || row.updated_by,
    };
  }

  private mapAllocationRuleRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      ruleCode: row.ruleCode || row.rule_code,
      ruleName: row.ruleName || row.rule_name,
      description: row.description,
      costPoolId: row.costPoolId || row.cost_pool_id,
      costDriverId: row.costDriverId || row.cost_driver_id,
      allocationMethod: row.allocationMethod || row.allocation_method,
      targetType: row.targetType || row.target_type,
      targetCostCategory: row.targetCostCategory || row.target_cost_category,
      rateType: row.rateType || row.rate_type,
      predeterminedRate: row.predeterminedRate || row.predetermined_rate,
      allocationFilters: row.allocationFilters || row.allocation_filters,
      allocationPriority: row.allocationPriority || row.allocation_priority,
      effectiveFrom: row.effectiveFrom || row.effective_from,
      effectiveTo: row.effectiveTo || row.effective_to,
      isActive: row.isActive ?? row.is_active,
      createdAt: row.createdAt || row.created_at,
      createdBy: row.createdBy || row.created_by,
      updatedAt: row.updatedAt || row.updated_at,
      updatedBy: row.updatedBy || row.updated_by,
    };
  }

  private mapAllocationRunRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      runNumber: row.runNumber || row.run_number,
      runDescription: row.runDescription || row.run_description,
      periodYear: row.periodYear || row.period_year,
      periodMonth: row.periodMonth || row.period_month,
      allocationType: row.allocationType || row.allocation_type,
      includedPools: row.includedPools || row.included_pools,
      includedJobs: row.includedJobs || row.included_jobs,
      startedAt: row.startedAt || row.started_at,
      completedAt: row.completedAt || row.completed_at,
      executionDurationMs: row.executionDurationMs || row.execution_duration_ms,
      status: row.status,
      totalPoolsProcessed: row.totalPoolsProcessed || row.total_pools_processed,
      totalAmountAllocated: row.totalAmountAllocated || row.total_amount_allocated,
      totalJobsAffected: row.totalJobsAffected || row.total_jobs_affected,
      totalAllocationsCreated: row.totalAllocationsCreated || row.total_allocations_created,
      errorMessage: row.errorMessage || row.error_message,
      errorDetails: row.errorDetails || row.error_details,
      isReversed: row.isReversed ?? row.is_reversed,
      reversedAt: row.reversedAt || row.reversed_at,
      reversedBy: row.reversedBy || row.reversed_by,
      reversalRunId: row.reversalRunId || row.reversal_run_id,
      createdBy: row.createdBy || row.created_by,
    };
  }

  private mapJobCostAllocationRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      allocationRunId: row.allocationRunId || row.allocation_run_id,
      jobCostId: row.jobCostId || row.job_cost_id,
      jobId: row.jobId || row.job_id,
      costPoolId: row.costPoolId || row.cost_pool_id,
      allocationRuleId: row.allocationRuleId || row.allocation_rule_id,
      costDriverId: row.costDriverId || row.cost_driver_id,
      driverQuantity: row.driverQuantity || row.driver_quantity,
      totalDriverQuantity: row.totalDriverQuantity || row.total_driver_quantity,
      allocationRate: row.allocationRate || row.allocation_rate,
      allocationPercentage: row.allocationPercentage || row.allocation_percentage,
      allocatedAmount: row.allocatedAmount || row.allocated_amount,
      costCategory: row.costCategory || row.cost_category,
      allocationMetadata: row.allocationMetadata || row.allocation_metadata,
      createdAt: row.createdAt || row.created_at,
    };
  }

  private mapDriverMeasurementRow(row: any) {
    return {
      id: row.id,
      tenantId: row.tenantId || row.tenant_id,
      jobId: row.jobId || row.job_id,
      costDriverId: row.costDriverId || row.cost_driver_id,
      periodYear: row.periodYear || row.period_year,
      periodMonth: row.periodMonth || row.period_month,
      measurementDate: row.measurementDate || row.measurement_date,
      measuredQuantity: row.measuredQuantity || row.measured_quantity,
      unitOfMeasure: row.unitOfMeasure || row.unit_of_measure,
      measurementSource: row.measurementSource || row.measurement_source,
      sourceId: row.sourceId || row.source_id,
      sourceReference: row.sourceReference || row.source_reference,
      notes: row.notes,
      createdAt: row.createdAt || row.created_at,
      createdBy: row.createdBy || row.created_by,
      updatedAt: row.updatedAt || row.updated_at,
      updatedBy: row.updatedBy || row.updated_by,
    };
  }

  private mapAllocationSummaryRow(row: any) {
    return {
      jobId: row.jobId || row.job_id,
      jobCostId: row.jobCostId || row.job_cost_id,
      allocationMonth: row.allocationMonth || row.allocation_month,
      totalAllocationRuns: row.totalAllocationRuns || row.total_allocation_runs,
      totalPoolsAllocated: row.totalPoolsAllocated || row.total_pools_allocated,
      totalAllocatedAmount: row.totalAllocatedAmount || row.total_allocated_amount,
      overheadAllocated: row.overheadAllocated || row.overhead_allocated,
      equipmentAllocated: row.equipmentAllocated || row.equipment_allocated,
      otherAllocated: row.otherAllocated || row.other_allocated,
      lastAllocationDate: row.lastAllocationDate || row.last_allocation_date,
    };
  }
}
