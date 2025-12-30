import { gql } from '@apollo/client';

// Query to get all quotes with filtering
export const GET_QUOTES = gql`
  query GetQuotes(
    $tenantId: ID!
    $status: String
    $customerId: ID
    $salesRepUserId: ID
    $dateFrom: Date
    $dateTo: Date
  ) {
    quotes(
      tenantId: $tenantId
      status: $status
      customerId: $customerId
      salesRepUserId: $salesRepUserId
      dateFrom: $dateFrom
      dateTo: $dateTo
    ) {
      id
      quoteNumber
      quoteDate
      expirationDate
      customerId
      customerName
      salesRepUserId
      salesRepName
      status
      subtotal
      taxAmount
      shippingAmount
      discountAmount
      totalAmount
      totalCost
      marginAmount
      marginPercentage
      createdAt
      updatedAt
    }
  }
`;

// Query to get a single quote by ID
export const GET_QUOTE = gql`
  query GetQuote($quoteId: ID!) {
    quote(id: $quoteId) {
      id
      quoteNumber
      quoteDate
      expirationDate
      customerId
      customerName
      contactName
      contactEmail
      contactPhone
      salesRepUserId
      salesRepName
      facilityId
      facilityName
      status
      quoteCurrencyCode
      termsAndConditions
      internalNotes
      subtotal
      taxAmount
      shippingAmount
      discountAmount
      totalAmount
      totalCost
      marginAmount
      marginPercentage
      convertedToSalesOrderId
      convertedAt
      createdAt
      createdBy
      updatedAt
      updatedBy
      lines {
        id
        lineNumber
        productId
        productCode
        description
        quantityQuoted
        unitOfMeasure
        unitPrice
        lineAmount
        discountPercentage
        discountAmount
        unitCost
        lineCost
        lineMargin
        marginPercentage
        manufacturingStrategy
        leadTimeDays
        promisedDeliveryDate
      }
    }
  }
`;

// Query to preview quote line pricing before creating
export const PREVIEW_QUOTE_LINE_PRICING = gql`
  query PreviewQuoteLinePricing(
    $tenantId: ID!
    $productId: ID!
    $customerId: ID!
    $quantity: Float!
    $quoteDate: Date
  ) {
    previewQuoteLinePricing(
      tenantId: $tenantId
      productId: $productId
      customerId: $customerId
      quantity: $quantity
      quoteDate: $quoteDate
    ) {
      unitPrice
      lineAmount
      discountAmount
      discountPercentage
      unitCost
      lineCost
      lineMargin
      marginPercentage
      priceSource
      appliedRules {
        ruleId
        ruleCode
        ruleName
        ruleType
        pricingAction
        actionValue
        priority
        discountApplied
      }
    }
  }
`;

// Query to preview product cost before creating
export const PREVIEW_PRODUCT_COST = gql`
  query PreviewProductCost(
    $tenantId: ID!
    $productId: ID!
    $quantity: Float!
  ) {
    previewProductCost(
      tenantId: $tenantId
      productId: $productId
      quantity: $quantity
    ) {
      unitCost
      totalCost
      materialCost
      laborCost
      overheadCost
      setupCost
      setupCostPerUnit
      costMethod
      costBreakdown {
        componentType
        componentCode
        componentName
        quantity
        unitOfMeasure
        unitCost
        totalCost
        scrapPercentage
      }
    }
  }
`;

// Mutation to create a quote with lines
export const CREATE_QUOTE_WITH_LINES = gql`
  mutation CreateQuoteWithLines($input: CreateQuoteWithLinesInput!) {
    createQuoteWithLines(input: $input) {
      id
      quoteNumber
      quoteDate
      expirationDate
      customerId
      customerName
      status
      subtotal
      totalAmount
      totalCost
      marginAmount
      marginPercentage
      lines {
        id
        lineNumber
        productCode
        description
        quantityQuoted
        unitPrice
        lineAmount
        unitCost
        lineCost
        lineMargin
        marginPercentage
      }
    }
  }
`;

// Mutation to add a quote line
export const ADD_QUOTE_LINE = gql`
  mutation AddQuoteLine($input: AddQuoteLineInput!) {
    addQuoteLine(input: $input) {
      id
      lineNumber
      productId
      productCode
      description
      quantityQuoted
      unitOfMeasure
      unitPrice
      lineAmount
      discountPercentage
      discountAmount
      unitCost
      lineCost
      lineMargin
      marginPercentage
      manufacturingStrategy
      leadTimeDays
      promisedDeliveryDate
    }
  }
`;

// Mutation to update a quote line
export const UPDATE_QUOTE_LINE = gql`
  mutation UpdateQuoteLine($input: UpdateQuoteLineInput!) {
    updateQuoteLine(input: $input) {
      id
      lineNumber
      productId
      productCode
      description
      quantityQuoted
      unitOfMeasure
      unitPrice
      lineAmount
      discountPercentage
      discountAmount
      unitCost
      lineCost
      lineMargin
      marginPercentage
      manufacturingStrategy
      leadTimeDays
      promisedDeliveryDate
    }
  }
`;

// Mutation to delete a quote line
export const DELETE_QUOTE_LINE = gql`
  mutation DeleteQuoteLine($quoteLineId: ID!) {
    deleteQuoteLine(quoteLineId: $quoteLineId)
  }
`;

// Mutation to recalculate a quote
export const RECALCULATE_QUOTE = gql`
  mutation RecalculateQuote(
    $quoteId: ID!
    $recalculateCosts: Boolean
    $recalculatePricing: Boolean
  ) {
    recalculateQuote(
      quoteId: $quoteId
      recalculateCosts: $recalculateCosts
      recalculatePricing: $recalculatePricing
    ) {
      id
      quoteNumber
      subtotal
      totalAmount
      totalCost
      marginAmount
      marginPercentage
      lines {
        id
        lineNumber
        unitPrice
        lineAmount
        unitCost
        lineCost
        lineMargin
        marginPercentage
      }
    }
  }
`;

// Mutation to validate quote margin
export const VALIDATE_QUOTE_MARGIN = gql`
  mutation ValidateQuoteMargin($quoteId: ID!) {
    validateQuoteMargin(quoteId: $quoteId) {
      isValid
      minimumMarginPercentage
      actualMarginPercentage
      requiresApproval
      approvalLevel
    }
  }
`;

// Mutation to update quote status
export const UPDATE_QUOTE_STATUS = gql`
  mutation UpdateQuoteStatus($quoteId: ID!, $status: String!) {
    updateQuote(id: $quoteId, status: $status) {
      id
      quoteNumber
      status
      updatedAt
    }
  }
`;

// Mutation to convert quote to sales order
export const CONVERT_QUOTE_TO_SALES_ORDER = gql`
  mutation ConvertQuoteToSalesOrder($quoteId: ID!) {
    convertQuoteToSalesOrder(quoteId: $quoteId) {
      id
      salesOrderNumber
      customerId
      totalAmount
      status
    }
  }
`;
