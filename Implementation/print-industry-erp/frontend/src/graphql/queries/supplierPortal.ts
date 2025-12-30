import { gql } from '@apollo/client';

// ============================================
// SUPPLIER PORTAL QUERIES
// ============================================
// REQ: REQ-STRATEGIC-AUTO-1767116143666 - Supply Chain Visibility & Supplier Portal

// ============================================
// SUPPLIER DASHBOARD
// ============================================

export const GET_SUPPLIER_DASHBOARD = gql`
  query GetSupplierDashboard {
    supplierDashboard {
      openPOCount
      openPOTotalValue
      pendingASNCount
      pendingShipmentCount
      currentPerformanceRating
      onTimeDeliveryPercentage
      qualityAcceptancePercentage
      vendorTier
      recentAlerts {
        id
        alertType
        alertCategory
        message
        status
        createdAt
        metricValue
        thresholdValue
        actionItems
      }
      recentActivity {
        id
        activityType
        activityDetails
        createdAt
      }
      recentPurchaseOrders {
        id
        poNumber
        poDate
        requestedDeliveryDate
        status
        totalAmount
        currency
        lineCount
        isAcknowledged
        hasASN
      }
    }
  }
`;

// ============================================
// PURCHASE ORDERS
// ============================================

export const GET_SUPPLIER_PURCHASE_ORDERS = gql`
  query GetSupplierPurchaseOrders(
    $status: [PurchaseOrderStatus!]
    $fromDate: Date
    $toDate: Date
    $limit: Int
    $offset: Int
  ) {
    supplierPurchaseOrders(
      status: $status
      fromDate: $fromDate
      toDate: $toDate
      limit: $limit
      offset: $offset
    ) {
      nodes {
        id
        poNumber
        poDate
        requestedDeliveryDate
        status
        totalAmount
        currency
        lineCount
        isAcknowledged
        hasASN
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        totalPages
      }
    }
  }
`;

export const GET_SUPPLIER_PURCHASE_ORDER = gql`
  query GetSupplierPurchaseOrder($poNumber: String!) {
    supplierPurchaseOrder(poNumber: $poNumber) {
      id
      poNumber
      poDate
      requestedDeliveryDate
      promisedDeliveryDate
      status
      buyerName
      buyerEmail
      buyerPhone
      buyerNotes
      shipToFacility {
        id
        facilityCode
        facilityName
        address {
          address1
          address2
          city
          state
          postalCode
          country
        }
      }
      shipToAddress {
        address1
        address2
        city
        state
        postalCode
        country
      }
      shippingMethod
      lines {
        id
        lineNumber
        materialId
        sku
        description
        quantity
        unitPrice
        unitOfMeasure
        extendedPrice
        requestedDate
        promisedDate
        quantityReceived
        quantityRemaining
      }
      subtotal
      taxAmount
      shippingAmount
      totalAmount
      currency
      acknowledgment {
        id
        purchaseOrderId
        poNumber
        acknowledgedAt
        acknowledgedByUser {
          id
          email
          firstName
          lastName
          role
          jobTitle
        }
        promisedDeliveryDate
        expectedLeadTimeDays
        acknowledgmentStatus
        acknowledgmentNotes
        proposedChanges {
          lineNumber
          field
          oldValue
          newValue
          reason
        }
      }
      acknowledgedAt
      acknowledgedByUser
      acknowledgmentNotes
      asns {
        id
        asnNumber
        carrierCode
        trackingNumber
        expectedDeliveryDate
        status
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`;

// ============================================
// ADVANCED SHIP NOTICES (ASN)
// ============================================

export const GET_SUPPLIER_ASNS = gql`
  query GetSupplierASNs(
    $status: [ASNStatus!]
    $limit: Int
    $offset: Int
  ) {
    supplierASNs(
      status: $status
      limit: $limit
      offset: $offset
    ) {
      nodes {
        id
        asnNumber
        purchaseOrderId
        poNumber
        carrierCode
        trackingNumber
        expectedDeliveryDate
        actualShipDate
        packageCount
        status
        createdAt
        submittedAt
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        totalPages
      }
    }
  }
`;

export const GET_SUPPLIER_ASN = gql`
  query GetSupplierASN($asnNumber: String!) {
    supplierASN(asnNumber: $asnNumber) {
      id
      asnNumber
      purchaseOrderId
      poNumber
      carrierCode
      carrierService
      trackingNumber
      proNumber
      expectedDeliveryDate
      actualShipDate
      estimatedArrivalDate
      packageCount
      totalWeight
      weightUnit
      totalVolume
      volumeUnit
      shipFromAddress {
        address1
        address2
        city
        state
        postalCode
        country
      }
      shipToAddress {
        address1
        address2
        city
        state
        postalCode
        country
      }
      lines {
        id
        poLineId
        lineNumber
        materialId
        sku
        description
        quantityShipped
        quantityOrdered
        unitOfMeasure
        lotNumber
        serialNumbers
        expirationDate
        packageNumber
        weight
        weightUnit
        quantityReceived
        quantityRejected
        rejectionReason
      }
      packingSlipUrl
      billOfLadingUrl
      commercialInvoiceUrl
      otherDocuments {
        type
        url
        filename
      }
      status
      createdAt
      updatedAt
      submittedAt
      createdByUser {
        id
        email
        firstName
        lastName
        role
        jobTitle
      }
      receivedAt
      receivedByUser
      receivingNotes
      receivingDiscrepancies {
        lineId
        lineNumber
        expectedQuantity
        actualQuantity
        variance
        reason
      }
    }
  }
`;

// ============================================
// PERFORMANCE
// ============================================

export const GET_SUPPLIER_PERFORMANCE = gql`
  query GetSupplierPerformance($year: Int!, $month: Int) {
    supplierPerformance(year: $year, month: $month) {
      vendorId
      vendorName
      vendorCode
      year
      month
      totalPOsIssued
      totalPOsValue
      onTimeDeliveryPercentage
      qualityAcceptancePercentage
      overallRating
      averageLeadTimeDays
      vendorTier
      onTimeDeliveryTrend
      qualityTrend
      previousMonthComparison {
        onTimeDeliveryChange
        qualityChange
        ratingChange
      }
    }
  }
`;

export const GET_SUPPLIER_PERFORMANCE_TRENDS = gql`
  query GetSupplierPerformanceTrends($months: Int) {
    supplierPerformanceTrends(months: $months) {
      year
      month
      onTimeDeliveryPercentage
      qualityAcceptancePercentage
      overallRating
      totalPOsIssued
    }
  }
`;

// ============================================
// ALERTS
// ============================================

export const GET_SUPPLIER_ALERTS = gql`
  query GetSupplierAlerts(
    $status: [AlertStatus!]
    $limit: Int
  ) {
    supplierAlerts(status: $status, limit: $limit) {
      id
      alertType
      alertCategory
      message
      status
      createdAt
      acknowledgedAt
      resolvedAt
      metricValue
      thresholdValue
      actionItems
    }
  }
`;

// ============================================
// DOCUMENTS
// ============================================

export const GET_SUPPLIER_DOCUMENTS = gql`
  query GetSupplierDocuments(
    $documentType: SupplierDocumentType
    $limit: Int
    $offset: Int
  ) {
    supplierDocuments(
      documentType: $documentType
      limit: $limit
      offset: $offset
    ) {
      nodes {
        id
        documentType
        documentCategory
        fileName
        fileSizeBytes
        mimeType
        storageUrl
        title
        description
        documentNumber
        documentDate
        expirationDate
        virusScanStatus
        uploadedAt
        uploadedByUser {
          id
          email
          firstName
          lastName
        }
        purchaseOrder {
          id
          poNumber
          poDate
          status
        }
        asn {
          id
          asnNumber
          expectedDeliveryDate
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        totalPages
      }
    }
  }
`;

// ============================================
// MUTATIONS
// ============================================

export const ACKNOWLEDGE_PURCHASE_ORDER = gql`
  mutation AcknowledgePurchaseOrder($input: AcknowledgePOInput!) {
    acknowledgePurchaseOrder(input: $input) {
      id
      purchaseOrderId
      poNumber
      acknowledgedAt
      acknowledgedByUser {
        id
        email
        firstName
        lastName
      }
      promisedDeliveryDate
      expectedLeadTimeDays
      acknowledgmentStatus
      acknowledgmentNotes
      proposedChanges {
        lineNumber
        field
        oldValue
        newValue
        reason
      }
    }
  }
`;

export const CREATE_ADVANCED_SHIP_NOTICE = gql`
  mutation CreateAdvancedShipNotice($input: CreateASNInput!) {
    createAdvancedShipNotice(input: $input) {
      id
      asnNumber
      purchaseOrderId
      poNumber
      carrierCode
      trackingNumber
      expectedDeliveryDate
      actualShipDate
      packageCount
      status
      createdAt
      createdByUser {
        id
        email
        firstName
        lastName
      }
    }
  }
`;

export const UPDATE_ADVANCED_SHIP_NOTICE = gql`
  mutation UpdateAdvancedShipNotice(
    $asnNumber: String!
    $input: UpdateASNInput!
  ) {
    updateAdvancedShipNotice(asnNumber: $asnNumber, input: $input) {
      id
      asnNumber
      carrierService
      trackingNumber
      proNumber
      expectedDeliveryDate
      estimatedArrivalDate
      status
      updatedAt
    }
  }
`;

export const UPLOAD_SUPPLIER_DOCUMENT = gql`
  mutation UploadSupplierDocument($input: UpplierDocumentInput!) {
    uploadSupplierDocument(input: $input) {
      id
      documentType
      fileName
      storageUrl
      virusScanStatus
      uploadedAt
      uploadedByUser {
        id
        email
        firstName
        lastName
      }
    }
  }
`;

export const UPDATE_SUPPLIER_CONTACT = gql`
  mutation UpdateSupplierContact($input: UpdateSupplierContactInput!) {
    updateSupplierContact(input: $input) {
      id
      email
      firstName
      lastName
      role
      jobTitle
    }
  }
`;
