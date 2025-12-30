import { gql } from '@apollo/client';

export const GET_CUSTOMER_ME = gql`
  query CustomerMe {
    customerMe {
      id
      customerId
      email
      firstName
      lastName
      phone
      role
      mfaEnabled
      isEmailVerified
      isActive
      preferredLanguage
      timezone
      lastLoginAt
      customer {
        id
        customerName
        customerCode
      }
    }
  }
`;

export const GET_CUSTOMER_ORDERS = gql`
  query CustomerOrders(
    $status: SalesOrderStatus
    $dateFrom: Date
    $dateTo: Date
    $limit: Int
    $offset: Int
  ) {
    customerOrders(
      status: $status
      dateFrom: $dateFrom
      dateTo: $dateTo
      limit: $limit
      offset: $offset
    ) {
      orders {
        id
        orderNumber
        orderDate
        status
        totalAmount
        currencyCode
        requestedDeliveryDate
        promisedDeliveryDate
        trackingNumber
        customerPoNumber
      }
      total
      hasMore
    }
  }
`;

export const GET_CUSTOMER_ORDER = gql`
  query CustomerOrder($orderNumber: String!) {
    customerOrder(orderNumber: $orderNumber) {
      id
      orderNumber
      orderDate
      status
      totalAmount
      currencyCode
      requestedDeliveryDate
      promisedDeliveryDate
      trackingNumber
      customerPoNumber
      lines {
        lineNumber
        productName
        quantity
        unitPrice
        totalPrice
        status
      }
    }
  }
`;

export const GET_CUSTOMER_QUOTES = gql`
  query CustomerQuotes($status: QuoteStatus, $limit: Int, $offset: Int) {
    customerQuotes(status: $status, limit: $limit, offset: $offset) {
      quotes {
        id
        quoteNumber
        quoteDate
        status
        expiresAt
        totalAmount
        currencyCode
        customerPoNumber
        lines {
          lineNumber
          productName
          quantity
          unitPrice
          totalPrice
        }
      }
      total
      hasMore
    }
  }
`;

export const GET_CUSTOMER_QUOTE = gql`
  query CustomerQuote($quoteNumber: String!) {
    customerQuote(quoteNumber: $quoteNumber) {
      id
      quoteNumber
      quoteDate
      status
      expiresAt
      totalAmount
      currencyCode
      customerPoNumber
      lines {
        lineNumber
        productName
        quantity
        unitPrice
        totalPrice
      }
    }
  }
`;

export const GET_CUSTOMER_PRODUCTS = gql`
  query CustomerProducts($category: String, $search: String, $limit: Int) {
    customerProducts(category: $category, search: $search, limit: $limit) {
      id
      productName
      productCode
      category
      description
      unitPrice
      currencyCode
    }
  }
`;

export const GET_CUSTOMER_PENDING_PROOFS = gql`
  query CustomerPendingProofs {
    customerPendingProofs {
      id
      orderId
      proofUrl
      version
      status
      approvedAt
      approvedBy
      revisionNotes
      customerComments
    }
  }
`;

export const GET_CUSTOMER_ORDER_PROOFS = gql`
  query CustomerOrderProofs($orderNumber: String!) {
    customerOrderProofs(orderNumber: $orderNumber) {
      id
      orderId
      proofUrl
      version
      status
      approvedAt
      approvedBy
      revisionNotes
      customerComments
    }
  }
`;

export const GET_CUSTOMER_ARTWORK_FILES = gql`
  query CustomerArtworkFiles($quoteId: ID, $orderId: ID) {
    customerArtworkFiles(quoteId: $quoteId, orderId: $orderId) {
      id
      orderId
      quoteId
      fileName
      fileUrl
      fileType
      fileSizeBytes
      virusScanStatus
      uploadedAt
    }
  }
`;
