/**
 * Invoice DTOs
 * REQ-STRATEGIC-AUTO-1767066329940
 */

export interface CreateInvoiceLineDto {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  accountId?: string;
  taxAmount?: number;
  discountAmount?: number;
}

export interface CreateInvoiceDto {
  tenantId: string;
  facilityId?: string;
  invoiceType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL' | 'CREDIT_MEMO' | 'DEBIT_MEMO';
  customerId?: string;
  vendorId?: string;
  invoiceNumber?: string; // Auto-generated if not provided
  invoiceDate: Date;
  dueDate: Date;
  currencyCode: string;
  exchangeRate?: number;
  lines: CreateInvoiceLineDto[];
  subtotal: number;
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  totalAmount: number;
  notes?: string;
  referenceNumber?: string;
  postToGL?: boolean; // Auto-post to GL
}

export interface UpdateInvoiceDto {
  invoiceDate?: Date;
  dueDate?: Date;
  notes?: string;
  referenceNumber?: string;
}

export interface VoidInvoiceDto {
  reason: string;
  voidDate: Date;
  reverseGL?: boolean; // Create reversing journal entry
}

export interface Invoice {
  id: string;
  tenantId: string;
  facilityId?: string;
  invoiceType: string;
  customerId?: string;
  vendorId?: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  status: string;
  paymentStatus: string;
  currencyCode: string;
  exchangeRate: number;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  periodYear?: number;
  periodMonth?: number;
  journalEntryId?: string;
  notes?: string;
  referenceNumber?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}
