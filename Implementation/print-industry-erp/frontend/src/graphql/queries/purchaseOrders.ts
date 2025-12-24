import { gql } from '@apollo/client';

// =====================================================
// PURCHASE ORDER QUERIES
// =====================================================

export const GET_PURCHASE_ORDERS = gql`
  query GetPurchaseOrders(
    $tenantId: ID!
    $facilityId: ID
    $vendorId: ID
    $status: PurchaseOrderStatus
    $startDate: Date
    $endDate: Date
    $limit: Int
    $offset: Int
  ) {
    purchaseOrders(
      tenantId: $tenantId
      facilityId: $facilityId
      vendorId: $vendorId
      status: $status
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
    ) {
      id
      poNumber
      purchaseOrderDate
      vendorId
      facilityId
      poCurrencyCode
      status
      subtotal
      taxAmount
      shippingAmount
      totalAmount
      requestedDeliveryDate
      promisedDeliveryDate
      requiresApproval
      approvedByUserId
      approvedAt
      createdAt
      createdBy
      updatedAt
    }
  }
`;

export const GET_PURCHASE_ORDER = gql`
  query GetPurchaseOrder($id: ID!) {
    purchaseOrder(id: $id) {
      id
      tenantId
      facilityId
      poNumber
      purchaseOrderDate
      vendorId
      shipToFacilityId
      shipToAddress
      billingEntityId
      buyerUserId
      poCurrencyCode
      exchangeRate
      subtotal
      taxAmount
      shippingAmount
      totalAmount
      paymentTerms
      requestedDeliveryDate
      promisedDeliveryDate
      status
      requiresApproval
      approvedByUserId
      approvedAt
      journalEntryId
      notes
      lines {
        id
        lineNumber
        materialId
        materialCode
        description
        quantityOrdered
        quantityReceived
        quantityRemaining
        unitOfMeasure
        unitPrice
        lineAmount
        requestedDeliveryDate
        promisedDeliveryDate
        expenseAccountId
        allowOverReceipt
        overReceiptTolerancePercentage
        status
      }
      createdAt
      createdBy
      updatedAt
      updatedBy
    }
  }
`;

export const GET_PURCHASE_ORDER_BY_NUMBER = gql`
  query GetPurchaseOrderByNumber($poNumber: String!) {
    purchaseOrderByNumber(poNumber: $poNumber) {
      id
      tenantId
      facilityId
      poNumber
      purchaseOrderDate
      vendorId
      status
      totalAmount
      lines {
        id
        lineNumber
        materialCode
        description
        quantityOrdered
        quantityReceived
        unitPrice
        lineAmount
        status
      }
    }
  }
`;

// =====================================================
// VENDOR QUERIES (for PO creation)
// =====================================================

export const GET_VENDORS = gql`
  query GetVendors(
    $tenantId: ID!
    $vendorType: VendorType
    $isActive: Boolean
    $isApproved: Boolean
    $limit: Int
    $offset: Int
  ) {
    vendors(
      tenantId: $tenantId
      vendorType: $vendorType
      isActive: $isActive
      isApproved: $isApproved
      limit: $limit
      offset: $offset
    ) {
      id
      vendorCode
      vendorName
      vendorType
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      paymentTerms
      paymentCurrencyCode
      isActive
      isApproved
    }
  }
`;

export const GET_VENDOR = gql`
  query GetVendor($id: ID!) {
    vendor(id: $id) {
      id
      tenantId
      vendorCode
      vendorName
      legalName
      vendorType
      primaryContactName
      primaryContactEmail
      primaryContactPhone
      addressLine1
      addressLine2
      city
      state
      postalCode
      country
      paymentTerms
      paymentCurrencyCode
      onTimeDeliveryPercentage
      qualityRatingPercentage
      overallRating
      isActive
      isApproved
    }
  }
`;

// =====================================================
// MATERIAL QUERIES (for PO line items)
// =====================================================

export const GET_MATERIALS = gql`
  query GetMaterials(
    $tenantId: ID!
    $materialType: MaterialType
    $isActive: Boolean
    $limit: Int
    $offset: Int
  ) {
    materials(
      tenantId: $tenantId
      materialType: $materialType
      isActive: $isActive
      limit: $limit
      offset: $offset
    ) {
      id
      materialCode
      materialName
      description
      materialType
      primaryUom
      standardCost
      lastCost
      defaultVendorId
      leadTimeDays
      minimumOrderQuantity
      isPurchasable
      isActive
    }
  }
`;

// =====================================================
// PURCHASE ORDER MUTATIONS
// =====================================================

export const CREATE_PURCHASE_ORDER = gql`
  mutation CreatePurchaseOrder(
    $tenantId: ID!
    $facilityId: ID!
    $vendorId: ID!
    $purchaseOrderDate: Date!
    $poCurrencyCode: String!
    $totalAmount: Float!
  ) {
    createPurchaseOrder(
      tenantId: $tenantId
      facilityId: $facilityId
      vendorId: $vendorId
      purchaseOrderDate: $purchaseOrderDate
      poCurrencyCode: $poCurrencyCode
      totalAmount: $totalAmount
    ) {
      id
      poNumber
      status
      totalAmount
    }
  }
`;

export const UPDATE_PURCHASE_ORDER = gql`
  mutation UpdatePurchaseOrder(
    $id: ID!
    $status: PurchaseOrderStatus
    $promisedDeliveryDate: Date
  ) {
    updatePurchaseOrder(
      id: $id
      status: $status
      promisedDeliveryDate: $promisedDeliveryDate
    ) {
      id
      poNumber
      status
      promisedDeliveryDate
      updatedAt
    }
  }
`;

export const APPROVE_PURCHASE_ORDER = gql`
  mutation ApprovePurchaseOrder($id: ID!, $approvedByUserId: ID!) {
    approvePurchaseOrder(id: $id, approvedByUserId: $approvedByUserId) {
      id
      poNumber
      status
      approvedByUserId
      approvedAt
    }
  }
`;

export const RECEIVE_PURCHASE_ORDER = gql`
  mutation ReceivePurchaseOrder($id: ID!, $receiptDetails: JSON!) {
    receivePurchaseOrder(id: $id, receiptDetails: $receiptDetails) {
      id
      poNumber
      status
      updatedAt
    }
  }
`;

export const CLOSE_PURCHASE_ORDER = gql`
  mutation ClosePurchaseOrder($id: ID!) {
    closePurchaseOrder(id: $id) {
      id
      poNumber
      status
      updatedAt
    }
  }
`;
