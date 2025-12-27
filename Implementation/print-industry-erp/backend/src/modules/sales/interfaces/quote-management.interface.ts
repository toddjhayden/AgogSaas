/**
 * Quote Management Service Interfaces
 * REQ-STRATEGIC-AUTO-1735125600000: Sales Quote Automation
 *
 * Defines interfaces for quote and quote line CRUD operations with automated
 * pricing and costing calculations.
 */

export interface CreateQuoteInput {
  tenantId: string;
  facilityId?: string;
  customerId: string;
  quoteDate: Date;
  expirationDate?: Date;
  quoteCurrencyCode: string;
  salesRepUserId?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  termsAndConditions?: string;
  createdBy: string;
}

export interface UpdateQuoteInput {
  quoteId: string;
  status?: QuoteStatus;
  expirationDate?: Date;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  termsAndConditions?: string;
  updatedBy: string;
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED_TO_ORDER = 'CONVERTED_TO_ORDER'
}

export interface QuoteResult {
  id: string;
  tenantId: string;
  facilityId: string | null;
  quoteNumber: string;
  quoteDate: Date;
  expirationDate: Date | null;
  customerId: string;
  contactName: string | null;
  contactEmail: string | null;
  salesRepUserId: string | null;
  quoteCurrencyCode: string;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  marginAmount: number;
  marginPercentage: number;
  status: QuoteStatus;
  convertedToSalesOrderId: string | null;
  convertedAt: Date | null;
  notes: string | null;
  termsAndConditions: string | null;
  lines: QuoteLineResult[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface AddQuoteLineInput {
  quoteId: string;
  productId: string;
  quantityQuoted: number;
  unitOfMeasure?: string;
  description?: string;
  manufacturingStrategy?: string;
  leadTimeDays?: number;
  promisedDeliveryDate?: Date;
  // Manual overrides (optional)
  manualUnitPrice?: number;
  manualDiscountPercentage?: number;
}

export interface UpdateQuoteLineInput {
  quoteLineId: string;
  quantityQuoted?: number;
  unitOfMeasure?: string;
  description?: string;
  manufacturingStrategy?: string;
  leadTimeDays?: number;
  promisedDeliveryDate?: Date;
  // Manual overrides
  manualUnitPrice?: number;
  manualDiscountPercentage?: number;
}

export interface QuoteLineResult {
  id: string;
  tenantId: string;
  quoteId: string;
  lineNumber: number;
  productId: string;
  productCode: string;
  description: string | null;
  quantityQuoted: number;
  unitOfMeasure: string | null;
  unitPrice: number;
  lineAmount: number;
  discountPercentage: number;
  discountAmount: number;
  unitCost: number;
  lineCost: number;
  lineMargin: number;
  marginPercentage: number;
  manufacturingStrategy: string | null;
  leadTimeDays: number | null;
  promisedDeliveryDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface DeleteQuoteLineInput {
  quoteLineId: string;
}

export interface RecalculateQuoteInput {
  quoteId: string;
  recalculateCosts?: boolean;
  recalculatePricing?: boolean;
}

export interface QuoteLineCalculation {
  unitPrice: number;
  lineAmount: number;
  discountPercentage: number;
  discountAmount: number;
  unitCost: number;
  lineCost: number;
  lineMargin: number;
  marginPercentage: number;
}

export interface QuoteValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface MarginValidationInput {
  quoteId?: string;
  lineMargin?: number;
  lineMarginPercentage?: number;
  productId?: string;
  customerId?: string;
}

export interface MarginValidationResult {
  isValid: boolean;
  minimumMarginPercentage: number;
  actualMarginPercentage: number;
  requiresApproval: boolean;
  approvalLevel: ApprovalLevel | null;
}

export enum ApprovalLevel {
  SALES_REP = 'SALES_REP',
  SALES_MANAGER = 'SALES_MANAGER',
  SALES_VP = 'SALES_VP',
  CFO = 'CFO'
}
