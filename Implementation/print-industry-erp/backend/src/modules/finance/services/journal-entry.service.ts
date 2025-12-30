/**
 * Journal Entry Service
 * REQ-STRATEGIC-AUTO-1767066329940
 *
 * Handles GL posting with validation and transaction management
 */

import { Injectable, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import {
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
  JournalEntry,
  JournalEntryLine,
} from '../dto/journal-entry.dto';
import {
  JournalEntryNotFoundException,
  JournalEntryImbalanceException,
  JournalEntryAlreadyPostedException,
  JournalEntryPeriodClosedException,
  JournalEntryCreationError,
  AccountNotFoundException,
  AccountInactiveException,
  AccountHeaderNotPostableException,
  AccountManualEntryNotAllowedException,
  FinancialPeriodClosedException,
} from '../exceptions/finance.exceptions';

@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);

  constructor(private readonly db: Pool) {}

  /**
   * Create journal entry with full validation and transaction safety
   */
  async createJournalEntry(
    dto: CreateJournalEntryDto,
    userId: string,
  ): Promise<JournalEntry> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Validate period is open
      await this.validatePeriodOpen(client, dto.tenantId, dto.periodYear, dto.periodMonth);

      // Validate all accounts exist and are postable
      for (const line of dto.lines) {
        await this.validateAccount(client, dto.tenantId, line.accountId, dto.entryType === 'MANUAL');
      }

      // Validate journal entry is balanced
      this.validateBalance(dto.lines);

      // Generate entry number
      const entryNumber = await this.generateEntryNumber(client, dto.tenantId, dto.periodYear, dto.periodMonth);

      // Calculate totals
      const totalDebit = dto.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
      const totalCredit = dto.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

      // Create journal entry header
      const entryResult = await client.query(
        `INSERT INTO journal_entries (
          tenant_id, facility_id, entry_number, period_year, period_month,
          entry_date, entry_type, status, description, total_debit, total_credit,
          reference_number, reversal_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          dto.tenantId,
          dto.facilityId,
          entryNumber,
          dto.periodYear,
          dto.periodMonth,
          dto.entryDate,
          dto.entryType,
          dto.requiresApproval ? 'PENDING_APPROVAL' : 'POSTED',
          dto.description,
          totalDebit,
          totalCredit,
          dto.referenceNumber,
          dto.reversalDate,
          userId,
        ],
      );

      const journalEntry = entryResult.rows[0];

      // Create journal entry lines
      for (const line of dto.lines) {
        await client.query(
          `INSERT INTO journal_entry_lines (
            tenant_id, journal_entry_id, account_id, debit_amount, credit_amount,
            description, department_id, project_id, job_id, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            dto.tenantId,
            journalEntry.id,
            line.accountId,
            line.debitAmount || 0,
            line.creditAmount || 0,
            line.description,
            line.departmentId,
            line.projectId,
            line.jobId,
            userId,
          ],
        );
      }

      // Update GL balances if posted
      if (!dto.requiresApproval) {
        await this.updateGLBalances(client, journalEntry.id, dto.tenantId, dto.periodYear, dto.periodMonth);
      }

      // Audit log
      await this.logJournalEntryAudit(client, dto.tenantId, journalEntry.id, 'CREATE', userId);

      await client.query('COMMIT');

      this.logger.log(`Created journal entry ${entryNumber} for tenant ${dto.tenantId}`);

      return this.mapJournalEntryRow(journalEntry);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create journal entry: ${error.message}`, error.stack);

      if (error instanceof JournalEntryImbalanceException ||
          error instanceof FinancialPeriodClosedException ||
          error instanceof AccountNotFoundException ||
          error instanceof AccountInactiveException ||
          error instanceof AccountHeaderNotPostableException ||
          error instanceof AccountManualEntryNotAllowedException) {
        throw error;
      }

      throw new JournalEntryCreationError(error);
    } finally {
      client.release();
    }
  }

  /**
   * Reverse a journal entry
   */
  async reverseJournalEntry(
    dto: ReverseJournalEntryDto,
    userId: string,
  ): Promise<JournalEntry> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Get original journal entry
      const originalResult = await client.query(
        `SELECT * FROM journal_entries WHERE id = $1 AND deleted_at IS NULL`,
        [dto.journalEntryId],
      );

      if (originalResult.rows.length === 0) {
        throw new JournalEntryNotFoundException(dto.journalEntryId);
      }

      const original = originalResult.rows[0];

      // Check if already reversed
      if (original.reversed_by_entry_id) {
        throw new JournalEntryAlreadyPostedException(dto.journalEntryId);
      }

      // Get original lines
      const linesResult = await client.query(
        `SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1 AND deleted_at IS NULL`,
        [dto.journalEntryId],
      );

      // Create reversing entry
      const reversalPeriod = this.getPeriodFromDate(dto.reversalDate);

      const reversingDto: CreateJournalEntryDto = {
        tenantId: original.tenant_id,
        facilityId: original.facility_id,
        periodYear: reversalPeriod.year,
        periodMonth: reversalPeriod.month,
        entryDate: dto.reversalDate,
        entryType: 'REVERSING',
        description: dto.description || `Reversal of JE ${original.entry_number}: ${original.description}`,
        lines: linesResult.rows.map(line => ({
          accountId: line.account_id,
          // Swap debits and credits
          debitAmount: line.credit_amount,
          creditAmount: line.debit_amount,
          description: line.description,
          departmentId: line.department_id,
          projectId: line.project_id,
          jobId: line.job_id,
        })),
        referenceNumber: `REV-${original.entry_number}`,
      };

      const reversingEntry = await this.createJournalEntry(reversingDto, userId);

      // Update original entry to mark as reversed
      await client.query(
        `UPDATE journal_entries SET reversed_by_entry_id = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [reversingEntry.id, userId, dto.journalEntryId],
      );

      // Update reversing entry to link to original
      await client.query(
        `UPDATE journal_entries SET reversal_of_entry_id = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [dto.journalEntryId, userId, reversingEntry.id],
      );

      await client.query('COMMIT');

      this.logger.log(`Reversed journal entry ${original.entry_number} with ${reversingEntry.entryNumber}`);

      return reversingEntry;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to reverse journal entry: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update GL balances after posting journal entry
   */
  async updateGLBalances(
    client: PoolClient,
    journalEntryId: string,
    tenantId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<void> {
    // Get all lines from journal entry
    const linesResult = await client.query(
      `SELECT account_id, debit_amount, credit_amount FROM journal_entry_lines
       WHERE journal_entry_id = $1 AND deleted_at IS NULL`,
      [journalEntryId],
    );

    // Update or insert GL balances for each account
    for (const line of linesResult.rows) {
      const netAmount = line.debit_amount - line.credit_amount;

      await client.query(
        `INSERT INTO gl_balances (
          tenant_id, account_id, period_year, period_month, debit_amount, credit_amount, balance_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (tenant_id, account_id, period_year, period_month)
        DO UPDATE SET
          debit_amount = gl_balances.debit_amount + EXCLUDED.debit_amount,
          credit_amount = gl_balances.credit_amount + EXCLUDED.credit_amount,
          balance_amount = gl_balances.balance_amount + EXCLUDED.balance_amount,
          updated_at = NOW()`,
        [tenantId, line.account_id, periodYear, periodMonth, line.debit_amount, line.credit_amount, netAmount],
      );
    }
  }

  /**
   * Validate journal entry balance (debits = credits)
   */
  private validateBalance(lines: any[]): void {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

    // Allow for small rounding differences (0.01)
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new JournalEntryImbalanceException(totalDebits, totalCredits);
    }
  }

  /**
   * Validate account exists and is postable
   */
  private async validateAccount(
    client: PoolClient,
    tenantId: string,
    accountId: string,
    isManualEntry: boolean,
  ): Promise<void> {
    const result = await client.query(
      `SELECT * FROM chart_of_accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [accountId, tenantId],
    );

    if (result.rows.length === 0) {
      throw new AccountNotFoundException(accountId);
    }

    const account = result.rows[0];

    if (!account.is_active) {
      throw new AccountInactiveException(account.account_number);
    }

    if (account.is_header) {
      throw new AccountHeaderNotPostableException(account.account_number);
    }

    if (isManualEntry && !account.allow_manual_entry) {
      throw new AccountManualEntryNotAllowedException(account.account_number);
    }
  }

  /**
   * Validate period is open for posting
   */
  private async validatePeriodOpen(
    client: PoolClient,
    tenantId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<void> {
    const result = await client.query(
      `SELECT status FROM financial_periods WHERE tenant_id = $1 AND period_year = $2 AND period_month = $3`,
      [tenantId, periodYear, periodMonth],
    );

    if (result.rows.length > 0 && result.rows[0].status === 'CLOSED') {
      throw new FinancialPeriodClosedException(periodYear, periodMonth);
    }
  }

  /**
   * Generate next journal entry number
   */
  private async generateEntryNumber(
    client: PoolClient,
    tenantId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<string> {
    const result = await client.query(
      `SELECT COUNT(*) as count FROM journal_entries
       WHERE tenant_id = $1 AND period_year = $2 AND period_month = $3`,
      [tenantId, periodYear, periodMonth],
    );

    const count = parseInt(result.rows[0].count) + 1;
    return `JE-${periodYear}${String(periodMonth).padStart(2, '0')}-${String(count).padStart(4, '0')}`;
  }

  /**
   * Get period year/month from date
   */
  private getPeriodFromDate(date: Date): { year: number; month: number } {
    const d = new Date(date);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    };
  }

  /**
   * Log journal entry audit trail
   */
  private async logJournalEntryAudit(
    client: PoolClient,
    tenantId: string,
    entityId: string,
    action: string,
    userId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO finance_audit_log (tenant_id, entity_type, entity_id, action, changed_by)
       VALUES ($1, 'JOURNAL_ENTRY', $2, $3, $4)`,
      [tenantId, entityId, action, userId],
    );
  }

  /**
   * Map database row to JournalEntry DTO
   */
  private mapJournalEntryRow(row: any): JournalEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      facilityId: row.facility_id,
      entryNumber: row.entry_number,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      entryDate: row.entry_date,
      entryType: row.entry_type,
      status: row.status,
      description: row.description,
      totalDebit: parseFloat(row.total_debit),
      totalCredit: parseFloat(row.total_credit),
      referenceNumber: row.reference_number,
      reversalDate: row.reversal_date,
      reversedByEntryId: row.reversed_by_entry_id,
      reversalOfEntryId: row.reversal_of_entry_id,
      createdAt: row.created_at,
      createdBy: row.created_by,
      postedAt: row.posted_at,
      postedBy: row.posted_by,
    };
  }
}
