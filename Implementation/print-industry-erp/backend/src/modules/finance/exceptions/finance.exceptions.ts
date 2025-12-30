/**
 * Finance Module Custom Exceptions
 * REQ-STRATEGIC-AUTO-1767066329940
 */

import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

// =====================================================
// INVOICE EXCEPTIONS
// =====================================================

export class InvoiceNotFoundException extends NotFoundException {
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} not found`);
  }
}

export class InvoiceAlreadyPaidException extends ConflictException {
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} is already fully paid and cannot be modified`);
  }
}

export class InvoiceAlreadyVoidedException extends ConflictException {
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} is already voided`);
  }
}

export class InvoiceTotalMismatchException extends BadRequestException {
  constructor(calculated: number, provided: number) {
    super(
      `Invoice total mismatch: calculated=${calculated}, provided=${provided}`,
    );
  }
}

// =====================================================
// PAYMENT EXCEPTIONS
// =====================================================

export class PaymentNotFoundException extends NotFoundException {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} not found`);
  }
}

export class InsufficientPaymentAmountException extends BadRequestException {
  constructor(paymentAmount: number, appliedAmount: number) {
    super(
      `Insufficient payment amount: payment=${paymentAmount}, trying to apply=${appliedAmount}`,
    );
  }
}

export class PaymentApplicationNotFoundException extends NotFoundException {
  constructor(applicationId: string) {
    super(`Payment application ${applicationId} not found`);
  }
}

export class PaymentAlreadyAppliedException extends ConflictException {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} is already fully applied`);
  }
}

// =====================================================
// JOURNAL ENTRY EXCEPTIONS
// =====================================================

export class JournalEntryNotFoundException extends NotFoundException {
  constructor(journalEntryId: string) {
    super(`Journal entry ${journalEntryId} not found`);
  }
}

export class JournalEntryImbalanceException extends BadRequestException {
  constructor(debits: number, credits: number) {
    super(
      `Journal entry is not balanced: debits=${debits}, credits=${credits}`,
    );
  }
}

export class JournalEntryAlreadyPostedException extends ConflictException {
  constructor(journalEntryId: string) {
    super(`Journal entry ${journalEntryId} is already posted`);
  }
}

export class JournalEntryPeriodClosedException extends ConflictException {
  constructor(periodYear: number, periodMonth: number) {
    super(
      `Cannot post to closed period: ${periodYear}-${String(periodMonth).padStart(2, '0')}`,
    );
  }
}

export class JournalEntryCreationError extends InternalServerErrorException {
  constructor(error: any) {
    super(`Failed to create journal entry: ${error.message}`);
  }
}

// =====================================================
// ACCOUNT EXCEPTIONS
// =====================================================

export class AccountNotFoundException extends NotFoundException {
  constructor(accountId: string) {
    super(`GL Account ${accountId} not found`);
  }
}

export class AccountInactiveException extends BadRequestException {
  constructor(accountNumber: string) {
    super(`Account ${accountNumber} is inactive and cannot be used`);
  }
}

export class AccountHeaderNotPostableException extends BadRequestException {
  constructor(accountNumber: string) {
    super(`Account ${accountNumber} is a header account and cannot accept postings`);
  }
}

export class AccountManualEntryNotAllowedException extends BadRequestException {
  constructor(accountNumber: string) {
    super(`Account ${accountNumber} does not allow manual journal entries`);
  }
}

// =====================================================
// PERIOD EXCEPTIONS
// =====================================================

export class FinancialPeriodNotFoundException extends NotFoundException {
  constructor(periodId: string) {
    super(`Financial period ${periodId} not found`);
  }
}

export class FinancialPeriodClosedException extends ConflictException {
  constructor(periodYear: number, periodMonth: number) {
    super(
      `Financial period ${periodYear}-${String(periodMonth).padStart(2, '0')} is closed`,
    );
  }
}

export class NoOpenFinancialPeriodException extends BadRequestException {
  constructor() {
    super('No open financial period found for posting');
  }
}

export class PeriodCloseValidationException extends BadRequestException {
  constructor(errors: string[]) {
    super(`Period cannot be closed: ${errors.join('; ')}`);
  }
}

export class PeriodAlreadyClosedException extends ConflictException {
  constructor(periodId: string) {
    super(`Period ${periodId} is already closed`);
  }
}

// =====================================================
// CUSTOMER/VENDOR EXCEPTIONS
// =====================================================

export class CustomerNotFoundException extends NotFoundException {
  constructor(customerId: string) {
    super(`Customer ${customerId} not found`);
  }
}

export class VendorNotFoundException extends NotFoundException {
  constructor(vendorId: string) {
    super(`Vendor ${vendorId} not found`);
  }
}

export class CustomerInactiveException extends BadRequestException {
  constructor(customerNumber: string) {
    super(`Customer ${customerNumber} is inactive`);
  }
}

export class VendorInactiveException extends BadRequestException {
  constructor(vendorNumber: string) {
    super(`Vendor ${vendorNumber} is inactive`);
  }
}

// =====================================================
// EXCHANGE RATE EXCEPTIONS
// =====================================================

export class ExchangeRateNotFoundException extends NotFoundException {
  constructor(fromCurrency: string, toCurrency: string, date: string) {
    super(
      `Exchange rate not found: ${fromCurrency} to ${toCurrency} on ${date}`,
    );
  }
}

export class InvalidExchangeRateException extends BadRequestException {
  constructor(message: string) {
    super(`Invalid exchange rate: ${message}`);
  }
}

// =====================================================
// COST ALLOCATION EXCEPTIONS
// =====================================================

export class CostAllocationNotFoundException extends NotFoundException {
  constructor(allocationId: string) {
    super(`Cost allocation ${allocationId} not found`);
  }
}

export class InvalidCostAllocationException extends BadRequestException {
  constructor(message: string) {
    super(`Invalid cost allocation: ${message}`);
  }
}
