/**
 * Payment Gateway DTOs
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * Data transfer objects for payment gateway operations (Stripe, ACH, etc.)
 */

export interface ProcessCardPaymentDto {
  tenantId: string;
  customerId: string;
  invoiceIds: string[];
  amount: number;
  currencyCode: string;
  paymentMethodId: string; // Stripe PaymentMethod ID (pm_xxx)
  savePaymentMethod?: boolean;
  facilityId?: string;
  notes?: string;
  userId?: string;
}

export interface ProcessACHPaymentDto {
  tenantId: string;
  customerId: string;
  invoiceIds: string[];
  amount: number;
  currencyCode: string;
  bankAccountId: string; // Stripe Bank Account ID
  facilityId?: string;
  notes?: string;
  userId?: string;
}

export interface SavePaymentMethodDto {
  tenantId: string;
  customerId: string;
  paymentMethodId: string; // From Stripe.js client-side tokenization
  setAsDefault?: boolean;
  userId?: string;
}

export interface VerifyBankAccountDto {
  tenantId: string;
  customerId: string;
  bankAccountId: string;
  amounts: number[]; // Micro-deposit amounts
  userId?: string;
}

export interface RefundPaymentDto {
  tenantId: string;
  paymentId: string;
  amount?: number; // Optional - full refund if not specified
  reason?: string;
  userId?: string;
}

export interface PaymentResult {
  success: boolean;
  payment?: any;
  gatewayTransaction?: PaymentGatewayTransaction;
  requiresAction?: boolean;
  clientSecret?: string;
  errorMessage?: string;
  errorCode?: string;
}

export interface PaymentGatewayTransaction {
  id: string;
  tenantId: string;
  paymentId?: string;
  gatewayProvider: string;
  gatewayTransactionId: string;
  gatewayCustomerId?: string;
  gatewayPaymentMethodId?: string;
  transactionType: string;
  amount: number;
  currencyCode: string;
  status: string;
  customerId?: string;
  customerEmail?: string;
  gatewayResponseCode?: string;
  gatewayResponseMessage?: string;
  gatewayRawResponse?: any;
  gatewayFeeAmount?: number;
  netAmount?: number;
  idempotencyKey?: string;
  webhookEventId?: string;
  webhookReceivedAt?: Date;
  initiatedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  errorCode?: string;
  retryCount?: number;
  lastRetryAt?: Date;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface CustomerPaymentMethod {
  id: string;
  tenantId: string;
  customerId: string;
  paymentMethodType: string;
  isDefault: boolean;
  gatewayProvider: string;
  gatewayPaymentMethodId: string;
  gatewayCustomerId?: string;
  displayName?: string;
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  cardFunding?: string;
  bankLast4?: string;
  bankName?: string;
  bankAccountType?: string;
  isActive: boolean;
  verified: boolean;
  verificationDate?: Date;
  verificationMethod?: string;
  fingerprint?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface BankAccount {
  id: string;
  tenantId: string;
  facilityId?: string;
  accountName: string;
  accountNumberMasked?: string;
  bankName?: string;
  routingNumberMasked?: string;
  accountType?: string;
  glAccountId: string;
  isGatewayAccount: boolean;
  gatewayProvider?: string;
  gatewayAccountId?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface CreatePaymentGatewayTransactionDto {
  tenantId: string;
  paymentId?: string;
  gatewayProvider: string;
  gatewayTransactionId: string;
  gatewayCustomerId?: string;
  gatewayPaymentMethodId?: string;
  transactionType: string;
  amount: number;
  currencyCode: string;
  status: string;
  customerId?: string;
  customerEmail?: string;
  gatewayResponseCode?: string;
  gatewayResponseMessage?: string;
  gatewayRawResponse?: any;
  gatewayFeeAmount?: number;
  netAmount?: number;
  idempotencyKey?: string;
  webhookEventId?: string;
  errorMessage?: string;
  errorCode?: string;
  userId?: string;
}

// Enums
export enum PaymentGatewayProvider {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  SQUARE = 'SQUARE',
  BRAINTREE = 'BRAINTREE',
  AUTHORIZE_NET = 'AUTHORIZE_NET',
}

export enum PaymentMethodType {
  CARD = 'CARD',
  ACH = 'ACH',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
  DEBIT_CARD = 'DEBIT_CARD',
}

export enum PaymentTransactionType {
  CHARGE = 'CHARGE',
  REFUND = 'REFUND',
  AUTHORIZATION = 'AUTHORIZATION',
  CAPTURE = 'CAPTURE',
  VOID = 'VOID',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PaymentTransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
  DISPUTED = 'DISPUTED',
}
