import { gql } from '@apollo/client';

export const GET_PL_SUMMARY = gql`
  query GetPLSummary($facilityId: UUID, $startDate: Date, $endDate: Date, $currency: String) {
    profitAndLoss(
      facilityId: $facilityId
      startDate: $startDate
      endDate: $endDate
      currency: $currency
    ) {
      revenue
      costOfGoodsSold
      grossProfit
      grossProfitMargin
      operatingExpenses
      operatingIncome
      operatingMargin
      netIncome
      netMargin
      currency
    }
  }
`;

export const GET_AR_AGING = gql`
  query GetARAging($facilityId: UUID, $asOfDate: Date) {
    accountsReceivableAging(facilityId: $facilityId, asOfDate: $asOfDate) {
      customerId
      customerName
      current
      days30
      days60
      days90
      days90Plus
      total
      currency
    }
  }
`;

export const GET_AP_AGING = gql`
  query GetAPAging($facilityId: UUID, $asOfDate: Date) {
    accountsPayableAging(facilityId: $facilityId, asOfDate: $asOfDate) {
      vendorId
      vendorName
      current
      days30
      days60
      days90
      days90Plus
      total
      currency
    }
  }
`;

export const GET_CASH_FLOW_FORECAST = gql`
  query GetCashFlowForecast($facilityId: UUID, $startDate: Date, $endDate: Date) {
    cashFlowForecast(facilityId: $facilityId, startDate: $startDate, endDate: $endDate) {
      date
      beginningBalance
      cashInflows {
        source
        amount
      }
      cashOutflows {
        category
        amount
      }
      netCashFlow
      endingBalance
    }
  }
`;

export const GET_MULTI_ENTITY_CONSOLIDATION = gql`
  query GetMultiEntityConsolidation($entityIds: [UUID!]!, $startDate: Date, $endDate: Date) {
    consolidatedFinancials(entityIds: $entityIds, startDate: $startDate, endDate: $endDate) {
      entityId
      entityName
      revenue
      expenses
      netIncome
      assets
      liabilities
      equity
      currency
    }
  }
`;

// =====================================================
// INVOICE QUERIES
// =====================================================

export const GET_INVOICES = gql`
  query GetInvoices(
    $tenantId: ID!
    $invoiceType: InvoiceType
    $customerId: ID
    $vendorId: ID
    $status: InvoiceStatus
    $startDate: Date
    $endDate: Date
    $limit: Int
    $offset: Int
  ) {
    invoices(
      tenantId: $tenantId
      invoiceType: $invoiceType
      customerId: $customerId
      vendorId: $vendorId
      status: $status
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      id
      invoiceNumber
      invoiceType
      customerId
      vendorId
      billToName
      invoiceDate
      dueDate
      currencyCode
      subtotal
      taxAmount
      totalAmount
      paidAmount
      balanceDue
      status
      paymentStatus
      paymentTerms
      purchaseOrderNumber
      notes
      createdAt
    }
  }
`;

export const GET_INVOICE = gql`
  query GetInvoice($id: ID!) {
    invoice(id: $id) {
      id
      tenantId
      facilityId
      invoiceNumber
      invoiceType
      customerId
      vendorId
      billToName
      billToAddressLine1
      billToCity
      billToPostalCode
      billToCountry
      invoiceDate
      dueDate
      currencyCode
      exchangeRate
      subtotal
      taxAmount
      shippingAmount
      discountAmount
      totalAmount
      paidAmount
      balanceDue
      status
      paymentStatus
      paymentTerms
      discountTerms
      purchaseOrderNumber
      salesOrderId
      shipmentId
      journalEntryId
      notes
      createdAt
      createdBy
      updatedAt
      updatedBy
      lines {
        id
        lineNumber
        materialId
        productId
        description
        quantity
        unitOfMeasure
        unitPrice
        lineAmount
        taxAmount
        discountAmount
        totalAmount
        revenueAccountId
        cogsAccountId
        salesOrderLineId
        shipmentLineId
      }
      payments {
        id
        paymentNumber
        paymentDate
        paymentAmount
        paymentMethod
        status
      }
    }
  }
`;

// =====================================================
// PAYMENT QUERIES
// =====================================================

export const GET_PAYMENTS = gql`
  query GetPayments(
    $tenantId: ID!
    $paymentType: PaymentType
    $customerId: ID
    $vendorId: ID
    $startDate: Date
    $endDate: Date
  ) {
    payments(
      tenantId: $tenantId
      paymentType: $paymentType
      customerId: $customerId
      vendorId: $vendorId
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      paymentNumber
      paymentType
      customerId
      vendorId
      paidByName
      paymentDate
      currencyCode
      paymentAmount
      paymentMethod
      referenceNumber
      checkNumber
      status
      notes
      createdAt
    }
  }
`;

export const GET_PAYMENT = gql`
  query GetPayment($id: ID!) {
    payment(id: $id) {
      id
      tenantId
      facilityId
      paymentNumber
      paymentType
      customerId
      vendorId
      paidByName
      paymentDate
      periodYear
      periodMonth
      currencyCode
      exchangeRate
      paymentAmount
      paymentMethod
      referenceNumber
      checkNumber
      transactionId
      bankAccountId
      depositDate
      status
      journalEntryId
      notes
      createdAt
      createdBy
      updatedAt
      updatedBy
      appliedInvoices {
        paymentId
        invoiceId
        amountApplied
        appliedDate
      }
    }
  }
`;

// =====================================================
// INVOICE MUTATIONS
// =====================================================

export const CREATE_INVOICE = gql`
  mutation CreateInvoice($input: CreateInvoiceInput!) {
    createInvoice(input: $input) {
      id
      invoiceNumber
      invoiceType
      billToName
      invoiceDate
      dueDate
      currencyCode
      subtotal
      taxAmount
      totalAmount
      status
      paymentStatus
    }
  }
`;

export const UPDATE_INVOICE = gql`
  mutation UpdateInvoice($id: ID!, $input: UpdateInvoiceInput!) {
    updateInvoice(id: $id, input: $input) {
      id
      invoiceNumber
      dueDate
      status
      notes
      updatedAt
    }
  }
`;

export const VOID_INVOICE = gql`
  mutation VoidInvoice($id: ID!) {
    voidInvoice(id: $id) {
      id
      invoiceNumber
      status
      updatedAt
    }
  }
`;

// =====================================================
// PAYMENT MUTATIONS
// =====================================================

export const CREATE_PAYMENT = gql`
  mutation CreatePayment($input: CreatePaymentInput!) {
    createPayment(input: $input) {
      id
      paymentNumber
      paymentType
      paymentDate
      paymentAmount
      paymentMethod
      status
    }
  }
`;

export const APPLY_PAYMENT = gql`
  mutation ApplyPayment($paymentId: ID!, $applications: [PaymentApplicationInput!]!) {
    applyPayment(paymentId: $paymentId, applications: $applications) {
      id
      paymentNumber
      paymentAmount
      status
      appliedInvoices {
        invoiceId
        amountApplied
        appliedDate
      }
    }
  }
`;
