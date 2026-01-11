/**
 * Payment DTOs
 * REQ-STRATEGIC-AUTO-1767066329940
 */

export interface ApplyPaymentToInvoiceDto {
  invoiceId: string;
  amountToApply: number;
}

export interface CreatePaymentDto {
  tenantId: string;
  facilityId?: string;
  paymentType: 'CUSTOMER_PAYMENT' | 'VENDOR_PAYMENT';
  customerId?: string;
  vendorId?: string;
  paymentNumber?: string; // Auto-generated if not provided
  paymentDate: Date;
  depositDate?: Date;
  amount: number;
  currencyCode: string;
  exchangeRate?: number;
  paymentMethod: 'CASH' | 'CHECK' | 'WIRE' | 'ACH' | 'CREDIT_CARD' | 'OTHER';
  checkNumber?: string;
  transactionId?: string;
  paidByName?: string;
  bankAccountId?: string;
  applyToInvoices?: ApplyPaymentToInvoiceDto[]; // Auto-apply to invoices with specific amounts
  invoiceIds?: string[]; // Alternative: simple array of invoice IDs (amount distributed evenly)
  notes?: string;
  referenceNumber?: string;
  postToGL?: boolean; // Auto-post to GL
}

export interface ApplyPaymentDto {
  paymentId: string;
  invoiceId: string;
  amountToApply: number;
  appliedDate: Date;
}

export interface UnapplyPaymentDto {
  applicationId: string;
  reason: string;
}

export interface VoidPaymentDto {
  reason: string;
  voidDate: Date;
  reverseGL?: boolean; // Create reversing journal entry
}

export interface Payment {
  id: string;
  tenantId: string;
  facilityId?: string;
  paymentType: string;
  customerId?: string;
  vendorId?: string;
  paymentNumber: string;
  paymentDate: Date;
  depositDate?: Date;
  amount: number;
  currencyCode: string;
  exchangeRate: number;
  paymentMethod: string;
  checkNumber?: string;
  transactionId?: string;
  paidByName?: string;
  bankAccountId?: string;
  unappliedAmount: number;
  periodYear?: number;
  periodMonth?: number;
  journalEntryId?: string;
  status: string;
  notes?: string;
  referenceNumber?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface PaymentApplication {
  id: string;
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  amountApplied: number;
  appliedDate: Date;
  journalEntryId?: string;
  status: string;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}
