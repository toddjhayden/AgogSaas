/**
 * Payment Gateway GraphQL Queries and Mutations
 * REQ-STRATEGIC-AUTO-1767084329261
 *
 * GraphQL operations for Stripe and ACH payment processing
 */

import { gql } from '@apollo/client';

// =====================================================
// QUERIES
// =====================================================

/**
 * Get customer payment methods
 */
export const GET_CUSTOMER_PAYMENT_METHODS = gql`
  query GetCustomerPaymentMethods($tenantId: ID!, $customerId: ID!) {
    customerPaymentMethods(tenantId: $tenantId, customerId: $customerId) {
      id
      tenantId
      customerId
      paymentMethodType
      isDefault
      gatewayProvider
      gatewayPaymentMethodId
      gatewayCustomerId
      displayName
      cardBrand
      cardLast4
      cardExpMonth
      cardExpYear
      cardFunding
      bankLast4
      bankName
      bankAccountType
      isActive
      verified
      verificationDate
      verificationMethod
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get payment gateway transaction by ID
 */
export const GET_PAYMENT_GATEWAY_TRANSACTION = gql`
  query GetPaymentGatewayTransaction($id: ID!) {
    paymentGatewayTransaction(id: $id) {
      id
      tenantId
      paymentId
      gatewayProvider
      gatewayTransactionId
      gatewayCustomerId
      gatewayPaymentMethodId
      transactionType
      amount
      currencyCode
      status
      customerId
      customerEmail
      gatewayResponseCode
      gatewayResponseMessage
      gatewayFeeAmount
      netAmount
      idempotencyKey
      webhookEventId
      webhookReceivedAt
      initiatedAt
      completedAt
      errorMessage
      errorCode
      retryCount
      lastRetryAt
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get payment gateway transactions with filters
 */
export const GET_PAYMENT_GATEWAY_TRANSACTIONS = gql`
  query GetPaymentGatewayTransactions(
    $tenantId: ID!
    $customerId: ID
    $status: String
    $startDate: Date
    $endDate: Date
    $limit: Int
    $offset: Int
  ) {
    paymentGatewayTransactions(
      tenantId: $tenantId
      customerId: $customerId
      status: $status
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      id
      tenantId
      paymentId
      gatewayProvider
      gatewayTransactionId
      transactionType
      amount
      currencyCode
      status
      customerId
      customerEmail
      gatewayResponseCode
      gatewayResponseMessage
      gatewayFeeAmount
      netAmount
      initiatedAt
      completedAt
      errorMessage
      errorCode
      createdAt
    }
  }
`;

// =====================================================
// MUTATIONS
// =====================================================

/**
 * Process card payment via Stripe
 */
export const PROCESS_CARD_PAYMENT = gql`
  mutation ProcessCardPayment($input: ProcessCardPaymentInput!) {
    processCardPayment(input: $input) {
      success
      payment {
        id
        paymentNumber
        amount
        currencyCode
        status
      }
      gatewayTransaction {
        id
        gatewayTransactionId
        status
        amount
        currencyCode
      }
      requiresAction
      clientSecret
      errorMessage
      errorCode
    }
  }
`;

/**
 * Process ACH payment via Stripe
 */
export const PROCESS_ACH_PAYMENT = gql`
  mutation ProcessACHPayment($input: ProcessACHPaymentInput!) {
    processACHPayment(input: $input) {
      success
      payment {
        id
        paymentNumber
        amount
        currencyCode
        status
      }
      gatewayTransaction {
        id
        gatewayTransactionId
        status
        amount
        currencyCode
      }
      requiresAction
      clientSecret
      errorMessage
      errorCode
    }
  }
`;

/**
 * Save payment method for customer
 */
export const SAVE_PAYMENT_METHOD = gql`
  mutation SavePaymentMethod($input: SavePaymentMethodInput!) {
    savePaymentMethod(input: $input) {
      id
      tenantId
      customerId
      paymentMethodType
      isDefault
      gatewayProvider
      gatewayPaymentMethodId
      displayName
      cardBrand
      cardLast4
      cardExpMonth
      cardExpYear
      bankLast4
      bankName
      isActive
      verified
      createdAt
    }
  }
`;

/**
 * Remove payment method
 */
export const REMOVE_PAYMENT_METHOD = gql`
  mutation RemovePaymentMethod($tenantId: ID!, $paymentMethodId: ID!) {
    removePaymentMethod(tenantId: $tenantId, paymentMethodId: $paymentMethodId)
  }
`;

/**
 * Verify bank account with micro-deposits
 */
export const VERIFY_BANK_ACCOUNT = gql`
  mutation VerifyBankAccount($input: VerifyBankAccountInput!) {
    verifyBankAccount(input: $input) {
      id
      tenantId
      customerId
      paymentMethodType
      isDefault
      gatewayProvider
      gatewayPaymentMethodId
      bankLast4
      bankName
      bankAccountType
      isActive
      verified
      verificationDate
      verificationMethod
      createdAt
    }
  }
`;

/**
 * Refund payment
 */
export const REFUND_PAYMENT = gql`
  mutation RefundPayment($input: RefundPaymentInput!) {
    refundPayment(input: $input) {
      success
      payment {
        id
        paymentNumber
        amount
        currencyCode
        status
      }
      gatewayTransaction {
        id
        gatewayTransactionId
        status
        amount
        currencyCode
        transactionType
      }
      errorMessage
      errorCode
    }
  }
`;
