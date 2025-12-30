# Research Report: Supply Chain Visibility & Supplier Portal

**REQ Number:** REQ-STRATEGIC-AUTO-1767116143666
**Feature Title:** Supply Chain Visibility & Supplier Portal
**Research Date:** 2025-12-30
**Researcher:** Cynthia (Research Specialist)
**Status:** COMPLETE

---

## Executive Summary

This research analyzes the requirements and implementation approach for a comprehensive **Supply Chain Visibility & Supplier Portal** system for the print industry ERP. The system will enable suppliers (vendors) to access real-time information about purchase orders, shipments, and performance metrics, while providing the organization with enhanced visibility into their supply chain operations.

**Key Findings:**
1. **Existing Infrastructure:** Strong foundation with 17 vendor/procurement tables, carrier shipping integrations, and customer portal authentication patterns to replicate
2. **Critical Gaps:** No supplier portal authentication, no PO visibility for vendors, no EDI/integration infrastructure, limited real-time tracking
3. **Implementation Priority:** High - Supply chain visibility is critical for JIT manufacturing in print industry
4. **Complexity:** Medium-High - Requires new authentication realm, API layer, real-time tracking, and notification system

---

## 1. Current State Analysis

### 1.1 Existing Vendor/Procurement Infrastructure

**Database Schema (Comprehensive):**

**Core Vendor Tables:**
- `vendors` (267 lines) - Master vendor data with tier segmentation (STRATEGIC/PREFERRED/TRANSACTIONAL)
- `vendor_contracts` - Long-term agreements with pricing
- `vendor_performance` - Monthly scorecards (OTD%, quality%, ratings)
- `vendor_performance_alerts` - Automated alerting system (CRITICAL/WARNING/TREND)
- `vendor_alert_thresholds` - Configurable per-tenant thresholds
- `materials_suppliers` - Material-specific vendor pricing with quantity breaks

**Purchase Order Tables:**
- `purchase_orders` - PO header with multi-currency, approval workflow
- `purchase_order_lines` - Line items with receiving tracking
- `po_approval_workflow_steps` - Multi-level approval routing
- `po_approval_actions` - Complete approval audit trail

**Key Features Already Implemented:**
```sql
-- Vendor tier classification with audit trail
ALTER TABLE vendors
  ADD COLUMN vendor_tier VARCHAR(20) DEFAULT 'TRANSACTIONAL'
  CHECK (vendor_tier IN ('STRATEGIC', 'PREFERRED', 'TRANSACTIONAL'));

ALTER TABLE vendors
  ADD COLUMN tier_calculation_basis JSONB;
  -- Stores: {annual_spend, material_types, assigned_by_user_id, rationale}

-- Performance alerts with workflow
CREATE TABLE vendor_performance_alerts (
  alert_type VARCHAR(50) CHECK (alert_type IN ('CRITICAL', 'WARNING', 'TREND')),
  alert_category VARCHAR(50) CHECK (alert_category IN ('OTD', 'QUALITY', 'RATING', 'COMPLIANCE')),
  alert_status VARCHAR(20) DEFAULT 'ACTIVE'
    CHECK (alert_status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'))
);
```

**Existing Services:**
- `VendorPerformanceService` - 12-month rolling metrics, ESG tracking
- `VendorTierClassificationService` - Automated tier assignment
- `VendorAlertEngineService` - Alert generation and workflow
- `ApprovalWorkflowService` - Multi-level PO approval routing

### 1.2 Existing Carrier Shipping Infrastructure

**Carrier Integration (REQ-STRATEGIC-AUTO-1767066329941):**

**Interface Layer:**
```typescript
// Unified carrier interface for FedEx, UPS, USPS, DHL
export interface ICarrierClient {
  // Address validation
  validateAddress(address: Address): Promise<AddressValidationResult>;

  // Rate shopping
  getRates(shipment: ShipmentRequest): Promise<RateQuote[]>;
  getRate(shipment: ShipmentRequest, serviceType: string): Promise<RateQuote>;

  // Shipment creation
  createShipment(shipment: ShipmentRequest): Promise<ShipmentConfirmation>;
  voidShipment(trackingNumber: string): Promise<void>;

  // Manifesting
  createManifest(shipmentIds: string[]): Promise<ManifestConfirmation>;
  closeManifest(manifestId: string): Promise<void>;

  // Real-time tracking
  getTrackingUpdates(trackingNumber: string): Promise<TrackingEvent[]>;
  getCurrentStatus(trackingNumber: string): Promise<TrackingEvent>;

  // Health check
  testConnection(): Promise<ConnectionStatus>;
}
```

**Tracking Status Enum:**
- LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY
- DELIVERED, EXCEPTION, RETURNED, CANCELLED

**Shipment Tables:**
- `shipments` - Shipment header with carrier, tracking, delivery dates
- `shipment_lines` - Line items linked to sales orders
- Tracking support for multi-package shipments

### 1.3 Existing Customer Portal Authentication Pattern

**Customer Portal Infrastructure (REQ-STRATEGIC-AUTO-1767048328659):**

**Authentication Tables:**
```sql
CREATE TABLE customer_users (
  -- Authentication
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),  -- bcrypt with salt rounds >= 10
  sso_provider VARCHAR(50),    -- GOOGLE, MICROSOFT

  -- MFA support
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),     -- TOTP for authenticator apps
  mfa_backup_codes JSONB,

  -- Customer-specific roles
  role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER_USER',
  -- CUSTOMER_ADMIN, CUSTOMER_USER, APPROVER

  -- Security (account lockout)
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMPTZ,

  -- Email verification
  is_email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),

  -- UNIQUE(customer_id, email)
);

CREATE TABLE refresh_tokens (
  customer_user_id UUID,
  token_hash VARCHAR(255) NOT NULL,  -- bcrypt hash (not plaintext)
  expires_at TIMESTAMPTZ NOT NULL,   -- 14 days
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(100)        -- PASSWORD_CHANGE, MANUAL_LOGOUT, etc.
);
```

**Authentication Service Features:**
- JWT access tokens (30 minutes) + refresh tokens (14 days)
- Account lockout after 5 failed login attempts
- Email verification required
- MFA support (TOTP)
- Password complexity validation
- SSO support (Google, Microsoft)

**Activity Logging:**
```sql
CREATE TABLE customer_activity_log (
  customer_user_id UUID,
  activity_type VARCHAR(50),  -- LOGIN, LOGOUT, VIEW_ORDER, UPLOAD_ARTWORK, etc.
  activity_details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT
);
```

---

## 2. Gap Analysis

### 2.1 Critical Gaps for Supplier Portal

| Gap ID | Gap Description | Impact | Priority |
|--------|----------------|---------|----------|
| **GAP-1** | **No Supplier Portal Authentication** | Suppliers cannot access system | CRITICAL |
| **GAP-2** | **No Supplier User Management** | Cannot create/manage supplier users | CRITICAL |
| **GAP-3** | **No PO Visibility API for Suppliers** | Suppliers cannot view their POs | CRITICAL |
| **GAP-4** | **No Shipment Visibility for Suppliers** | Suppliers cannot view inbound shipments | HIGH |
| **GAP-5** | **No ASN (Advanced Ship Notice) Capability** | Suppliers cannot notify of incoming shipments | HIGH |
| **GAP-6** | **No EDI/Integration Infrastructure** | No automated data exchange (EDI 850/856/810) | HIGH |
| **GAP-7** | **No Supplier Performance Dashboard** | Suppliers cannot see their scorecards | MEDIUM |
| **GAP-8** | **No Document Upload for Suppliers** | Cannot attach packing slips, invoices | MEDIUM |
| **GAP-9** | **No Notification System for Suppliers** | No email alerts for new POs, changes | MEDIUM |
| **GAP-10** | **Limited Real-Time Tracking Integration** | Carrier tracking exists but not exposed to suppliers | LOW |

### 2.2 Supply Chain Visibility Gaps

| Gap ID | Gap Description | Impact | Priority |
|--------|----------------|---------|----------|
| **VISIBILITY-1** | **No Supply Chain Dashboard** | Cannot see end-to-end supply chain status | HIGH |
| **VISIBILITY-2** | **No PO Status Tracking** | Limited visibility into PO lifecycle | HIGH |
| **VISIBILITY-3** | **No Inbound Shipment Tracking** | Cannot track materials in transit | HIGH |
| **VISIBILITY-4** | **No Inventory Visibility Across Facilities** | Multi-facility inventory not visible | MEDIUM |
| **VISIBILITY-5** | **No Supplier Lead Time Analytics** | Cannot analyze actual vs. promised delivery | MEDIUM |
| **VISIBILITY-6** | **No Supply Chain Exception Management** | No alerts for delays, quality issues | MEDIUM |

---

## 3. Industry Standards & Best Practices

### 3.1 EDI (Electronic Data Interchange) Standards

**ANSI X12 EDI Documents for Print Industry:**

| EDI Transaction | Purpose | Direction | Priority |
|----------------|---------|-----------|----------|
| **EDI 850** | Purchase Order | ERP → Supplier | CRITICAL |
| **EDI 855** | PO Acknowledgment | Supplier → ERP | HIGH |
| **EDI 856** | Advanced Ship Notice (ASN) | Supplier → ERP | HIGH |
| **EDI 810** | Invoice | Supplier → ERP | HIGH |
| **EDI 997** | Functional Acknowledgment | Bidirectional | MEDIUM |
| **EDI 860** | PO Change Order | ERP → Supplier | MEDIUM |
| **EDI 846** | Inventory Inquiry/Advice | Bidirectional | LOW |

**EDI Data Elements (Sample for EDI 850 PO):**
```
ST*850*0001                    (Transaction Set Header)
BEG*00*NE*PO123456*20251230    (Beginning Segment)
REF*DP*Department 42           (Reference Identification)
DTM*002*20251230               (Date/Time - Delivery Requested)
N1*ST*Ship To Name             (Name)
N3*123 Main St                 (Address)
N4*Chicago*IL*60601            (City, State, ZIP)
PO1*1*1000*SH*10.50*EA*BP*PAPER-80LB-GLOSS (Baseline Item Data)
CTT*1                          (Transaction Totals)
SE*9*0001                      (Transaction Set Trailer)
```

### 3.2 Supplier Portal Best Practices

**Authentication & Security:**
- Separate authentication realm from internal users (CRITICAL)
- Role-based access control (VENDOR_ADMIN, VENDOR_USER)
- MFA recommended for high-value suppliers
- API rate limiting to prevent abuse
- Audit logging of all supplier actions

**Portal Features (Industry Standard):**
1. **Dashboard:**
   - Open PO count and total value
   - Pending shipments count
   - Performance scorecard summary
   - Recent activity feed

2. **Purchase Orders:**
   - View open POs by date range
   - PO detail view (line items, delivery dates, shipping address)
   - Export to PDF/CSV
   - Acknowledge PO electronically

3. **Shipments:**
   - Create ASN (Advanced Ship Notice)
   - Upload packing slip, BOL (Bill of Lading)
   - View shipment tracking
   - Record actual ship dates

4. **Performance:**
   - View monthly scorecards
   - OTD%, quality%, overall rating
   - Trend charts (12-month rolling)
   - Alerts/action items

5. **Documents:**
   - Upload certificates (ISO, FDA, FSC)
   - Upload invoices
   - Download PO PDFs
   - Access SDS (Safety Data Sheets)

### 3.3 Real-Time Tracking Integration

**Carrier Webhook Support:**

Most carriers support webhook notifications for tracking events:

| Carrier | Webhook Support | Events | Authentication |
|---------|----------------|--------|----------------|
| **FedEx** | Yes (Track API v1) | All tracking events | OAuth 2.0 |
| **UPS** | Yes (Tracking API) | All tracking events | OAuth 2.0 |
| **USPS** | Limited (Informed Delivery) | Delivery only | API Key |
| **DHL** | Yes (Shipment Tracking API) | All tracking events | API Key |

**Webhook Event Structure:**
```json
{
  "trackingNumber": "1Z999AA10123456784",
  "carrier": "UPS",
  "timestamp": "2025-12-30T14:35:00Z",
  "status": "IN_TRANSIT",
  "statusCode": "I",
  "statusDescription": "In Transit - On Time",
  "location": {
    "city": "Chicago",
    "state": "IL",
    "country": "US"
  },
  "estimatedDeliveryDate": "2025-12-31T17:00:00Z"
}
```

---

## 4. Recommended Architecture

### 4.1 Supplier Portal Authentication Architecture

**Database Tables:**

```sql
-- ============================================
-- TABLE: supplier_users
-- ============================================
-- Purpose: Supplier portal user accounts (separate realm from internal/customer users)
-- Pattern: Mirror customer_users table structure

CREATE TABLE supplier_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  vendor_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Authentication
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),        -- bcrypt with salt rounds >= 10
  sso_provider VARCHAR(50),          -- GOOGLE, MICROSOFT (for enterprise suppliers)
  sso_user_id VARCHAR(255),

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  job_title VARCHAR(100),            -- Purchasing Manager, Logistics Coordinator, etc.

  -- MFA
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  mfa_backup_codes JSONB,

  -- Supplier-specific roles
  role VARCHAR(50) NOT NULL DEFAULT 'VENDOR_USER',
  -- VENDOR_ADMIN: Can manage other vendor users, view all POs
  -- VENDOR_USER: Can view assigned POs, create ASNs
  -- VENDOR_VIEWER: Read-only access to performance data

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMPTZ,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMPTZ,

  -- Security (account lockout)
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(50),
  password_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Preferences
  preferred_language VARCHAR(10) DEFAULT 'en-US',
  timezone VARCHAR(100) DEFAULT 'America/New_York',
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}'::JSONB,

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,  -- Internal user who created this supplier user
  deleted_at TIMESTAMPTZ,

  UNIQUE(vendor_id, email),
  CONSTRAINT fk_supplier_users_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT fk_supplier_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT chk_supplier_users_role CHECK (role IN ('VENDOR_ADMIN', 'VENDOR_USER', 'VENDOR_VIEWER'))
);

-- Indexes
CREATE INDEX idx_supplier_users_email ON supplier_users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_users_vendor_id ON supplier_users(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_supplier_users_tenant_id ON supplier_users(tenant_id);

-- RLS
ALTER TABLE supplier_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_users_tenant_isolation ON supplier_users
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- TABLE: supplier_activity_log
-- ============================================
-- Purpose: Audit trail for supplier portal actions

CREATE TABLE supplier_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  supplier_user_id UUID,

  -- Activity
  activity_type VARCHAR(50) NOT NULL,
  -- LOGIN, LOGOUT, VIEW_PO, ACKNOWLEDGE_PO, CREATE_ASN, UPLOAD_DOCUMENT, etc.
  activity_details JSONB,

  -- Session context
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_supplier_activity_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_supplier_activity_user FOREIGN KEY (supplier_user_id) REFERENCES supplier_users(id),
  CONSTRAINT fk_supplier_activity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_supplier_activity_vendor ON supplier_activity_log(vendor_id);
CREATE INDEX idx_supplier_activity_user ON supplier_activity_log(supplier_user_id);
CREATE INDEX idx_supplier_activity_created ON supplier_activity_log(created_at DESC);
CREATE INDEX idx_supplier_activity_type ON supplier_activity_log(activity_type);

ALTER TABLE supplier_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_activity_log_tenant_isolation ON supplier_activity_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);
```

**Authentication Service:**

```typescript
// Mirror CustomerAuthService structure
@Injectable()
export class SupplierAuthService {
  // Register new supplier user
  async register(
    vendorCode: string,
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<SupplierAuthResponse>;

  // Login
  async login(
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<SupplierAuthResponse>;

  // Verify email
  async verifyEmail(token: string): Promise<void>;

  // Password reset
  async requestPasswordReset(email: string): Promise<void>;
  async resetPassword(token: string, newPassword: string): Promise<void>;

  // Refresh token
  async refreshAccessToken(refreshToken: string): Promise<SupplierAuthResponse>;

  // Logout
  async logout(refreshToken: string): Promise<void>;
}
```

### 4.2 Supplier Portal API Layer

**GraphQL Schema:**

```graphql
# ============================================
# SUPPLIER PORTAL QUERIES
# ============================================

type Query {
  # Dashboard metrics
  supplierDashboard: SupplierDashboard!

  # Purchase orders
  supplierPurchaseOrders(
    status: [PurchaseOrderStatus!]
    fromDate: Date
    toDate: Date
    limit: Int = 50
    offset: Int = 0
  ): SupplierPurchaseOrderConnection!

  supplierPurchaseOrder(poNumber: String!): SupplierPurchaseOrder!

  # Shipments
  supplierShipments(
    status: [ShipmentStatus!]
    limit: Int = 50
    offset: Int = 0
  ): SupplierShipmentConnection!

  # Performance
  supplierPerformance(
    year: Int!
    month: Int
  ): SupplierPerformanceScorecard!

  supplierPerformanceTrends(
    months: Int = 12
  ): [SupplierPerformanceMonth!]!

  # Alerts
  supplierAlerts(
    status: [AlertStatus!] = [ACTIVE]
    limit: Int = 20
  ): [SupplierAlert!]!
}

# ============================================
# SUPPLIER PORTAL MUTATIONS
# ============================================

type Mutation {
  # PO acknowledgment
  acknowledgePurchaseOrder(
    poNumber: String!
    expectedDeliveryDate: Date
    notes: String
  ): PurchaseOrder!

  # ASN (Advanced Ship Notice)
  createAdvancedShipNotice(input: ASNInput!): AdvancedShipNotice!
  updateAdvancedShipNotice(id: ID!, input: ASNUpdateInput!): AdvancedShipNotice!

  # Document upload
  uploadSupplierDocument(input: SupplierDocumentInput!): SupplierDocument!

  # Update contact info
  updateSupplierContact(input: SupplierContactInput!): SupplierUser!
}

# ============================================
# TYPES
# ============================================

type SupplierDashboard {
  openPOCount: Int!
  openPOTotalValue: Decimal!
  pendingShipmentCount: Int!
  currentPerformanceRating: Decimal
  recentAlerts: [SupplierAlert!]!
  recentActivity: [SupplierActivity!]!
}

type SupplierPurchaseOrder {
  id: ID!
  poNumber: String!
  poDate: Date!
  requestedDeliveryDate: Date
  promisedDeliveryDate: Date
  status: PurchaseOrderStatus!

  # Buyer info
  buyerName: String
  buyerEmail: String
  buyerPhone: String

  # Shipping
  shipToFacility: Facility!
  shipToAddress: Address!

  # Lines
  lines: [PurchaseOrderLine!]!

  # Totals
  subtotal: Decimal!
  taxAmount: Decimal!
  shippingAmount: Decimal!
  totalAmount: Decimal!
  currency: String!

  # Documents
  documents: [PODocument!]!

  # Acknowledgment
  acknowledgedAt: DateTime
  acknowledgedByUser: String
  acknowledgmentNotes: String
}

type AdvancedShipNotice {
  id: ID!
  asnNumber: String!
  purchaseOrderId: ID!
  poNumber: String!

  # Shipment details
  carrierCode: String!
  carrierService: String
  trackingNumber: String
  expectedDeliveryDate: Date!
  actualShipDate: Date!

  # Package details
  packageCount: Int!
  totalWeight: Decimal!
  weightUnit: String!

  # Lines
  lines: [ASNLine!]!

  # Documents
  packingSlipUrl: String
  billOfLadingUrl: String

  # Status
  status: ASNStatus!
  createdAt: DateTime!
  createdBy: SupplierUser!
}

input ASNInput {
  purchaseOrderId: ID!
  carrierCode: String!
  trackingNumber: String
  expectedDeliveryDate: Date!
  actualShipDate: Date!
  packageCount: Int!
  totalWeight: Decimal!
  weightUnit: String!
  lines: [ASNLineInput!]!
  packingSlipUrl: String
  billOfLadingUrl: String
}

input ASNLineInput {
  poLineId: ID!
  quantityShipped: Decimal!
  lotNumber: String
  serialNumbers: [String!]
}

type SupplierPerformanceScorecard {
  vendorId: ID!
  vendorName: String!
  year: Int!
  month: Int!

  # Metrics
  totalPOsIssued: Int!
  totalPOsValue: Decimal!
  onTimeDeliveryPercentage: Decimal!
  qualityAcceptancePercentage: Decimal!
  overallRating: Decimal!

  # Tier
  vendorTier: VendorTier!

  # Trends
  onTimeDeliveryTrend: Trend!
  qualityTrend: Trend!
}

type SupplierAlert {
  id: ID!
  alertType: AlertType!
  alertCategory: AlertCategory!
  message: String!
  status: AlertStatus!
  createdAt: DateTime!
  metricValue: Decimal
  thresholdValue: Decimal
}

enum VendorTier {
  STRATEGIC
  PREFERRED
  TRANSACTIONAL
}

enum AlertType {
  CRITICAL
  WARNING
  TREND
}

enum AlertCategory {
  OTD          # On-Time Delivery
  QUALITY
  RATING
  COMPLIANCE
}

enum AlertStatus {
  ACTIVE
  ACKNOWLEDGED
  RESOLVED
  DISMISSED
}

enum Trend {
  IMPROVING
  STABLE
  DECLINING
}
```

### 4.3 EDI Integration Architecture

**Database Tables:**

```sql
-- ============================================
-- TABLE: edi_documents
-- ============================================
-- Purpose: EDI transaction log (all inbound/outbound EDI messages)

CREATE TABLE edi_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID,

  -- Document type
  transaction_set_id VARCHAR(10) NOT NULL,  -- 850, 855, 856, 810, etc.
  transaction_name VARCHAR(100) NOT NULL,   -- Purchase Order, ASN, Invoice, etc.
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),

  -- Document identifiers
  control_number VARCHAR(50),
  interchange_control_number VARCHAR(50),
  group_control_number VARCHAR(50),

  -- Business document reference
  purchase_order_id UUID,
  shipment_id UUID,
  invoice_id UUID,

  -- EDI content
  edi_content TEXT NOT NULL,  -- Raw EDI X12 format
  parsed_json JSONB,          -- Parsed EDI as JSON for easy querying

  -- Processing status
  status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  -- RECEIVED, PARSING, PARSED, PROCESSING, PROCESSED, ERROR, REJECTED

  error_message TEXT,
  error_code VARCHAR(50),

  -- Partner info
  sender_id VARCHAR(50),
  sender_qualifier VARCHAR(2),
  receiver_id VARCHAR(50),
  receiver_qualifier VARCHAR(2),

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT fk_edi_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_edi_documents_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_edi_documents_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_edi_documents_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

CREATE INDEX idx_edi_documents_tenant ON edi_documents(tenant_id);
CREATE INDEX idx_edi_documents_vendor ON edi_documents(vendor_id);
CREATE INDEX idx_edi_documents_transaction_set ON edi_documents(transaction_set_id);
CREATE INDEX idx_edi_documents_direction ON edi_documents(direction);
CREATE INDEX idx_edi_documents_status ON edi_documents(status);
CREATE INDEX idx_edi_documents_po ON edi_documents(purchase_order_id);
CREATE INDEX idx_edi_documents_received ON edi_documents(received_at DESC);

-- ============================================
-- TABLE: edi_partner_configurations
-- ============================================
-- Purpose: EDI trading partner settings

CREATE TABLE edi_partner_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,

  -- Trading partner IDs
  sender_id VARCHAR(50) NOT NULL,        -- Our ISA sender ID
  sender_qualifier VARCHAR(2) NOT NULL,  -- ZZ, 01, 14, etc.
  receiver_id VARCHAR(50) NOT NULL,      -- Partner ISA receiver ID
  receiver_qualifier VARCHAR(2) NOT NULL,

  -- Connection method
  connection_type VARCHAR(20) NOT NULL,
  -- AS2, SFTP, VAN (Value Added Network), API

  -- AS2 configuration
  as2_url TEXT,
  as2_identifier VARCHAR(100),
  as2_certificate TEXT,

  -- SFTP configuration
  sftp_host VARCHAR(255),
  sftp_port INTEGER,
  sftp_username VARCHAR(100),
  sftp_directory VARCHAR(255),
  sftp_public_key TEXT,

  -- Supported transactions
  supported_transactions JSONB,
  -- ["850", "855", "856", "810"]

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  test_mode BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT fk_edi_partner_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_edi_partner_config_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  UNIQUE(tenant_id, vendor_id)
);

CREATE INDEX idx_edi_partner_config_vendor ON edi_partner_configurations(vendor_id);
CREATE INDEX idx_edi_partner_config_active ON edi_partner_configurations(is_active);
```

**EDI Processing Service:**

```typescript
@Injectable()
export class EDIProcessingService {
  // Outbound: Generate EDI 850 (PO) from purchase_orders
  async generatePO850(purchaseOrderId: string): Promise<string>;

  // Inbound: Parse EDI 855 (PO Acknowledgment)
  async parseAndProcessPOAck855(ediContent: string): Promise<void>;

  // Inbound: Parse EDI 856 (ASN - Advanced Ship Notice)
  async parseAndProcessASN856(ediContent: string): Promise<void>;

  // Inbound: Parse EDI 810 (Invoice)
  async parseAndProcessInvoice810(ediContent: string): Promise<void>;

  // Send EDI document via AS2/SFTP/VAN
  async sendEDIDocument(
    vendorId: string,
    transactionSetId: string,
    ediContent: string
  ): Promise<void>;

  // Process received EDI document
  async processReceivedEDIDocument(
    vendorId: string,
    ediContent: string
  ): Promise<void>;
}
```

### 4.4 Real-Time Tracking Webhook Architecture

**Database Tables:**

```sql
-- ============================================
-- TABLE: carrier_tracking_events
-- ============================================
-- Purpose: Store all carrier tracking events (webhook data)

CREATE TABLE carrier_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  shipment_id UUID,

  -- Carrier info
  carrier_code VARCHAR(20) NOT NULL,  -- FEDEX, UPS, USPS, DHL
  tracking_number VARCHAR(100) NOT NULL,

  -- Event details
  event_timestamp TIMESTAMPTZ NOT NULL,
  status_code VARCHAR(50) NOT NULL,
  status_description TEXT,
  event_type VARCHAR(50) NOT NULL,
  -- LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION

  -- Location
  event_city VARCHAR(100),
  event_state VARCHAR(100),
  event_country VARCHAR(100),
  event_postal_code VARCHAR(20),

  -- Exception details
  exception_code VARCHAR(50),
  exception_description TEXT,

  -- Delivery
  delivered_to_name VARCHAR(255),
  signature_available BOOLEAN DEFAULT FALSE,
  proof_of_delivery_url TEXT,

  -- Raw webhook payload
  raw_webhook_payload JSONB,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_tracking_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_tracking_events_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

CREATE INDEX idx_tracking_events_shipment ON carrier_tracking_events(shipment_id);
CREATE INDEX idx_tracking_events_tracking_number ON carrier_tracking_events(tracking_number);
CREATE INDEX idx_tracking_events_timestamp ON carrier_tracking_events(event_timestamp DESC);
CREATE INDEX idx_tracking_events_carrier ON carrier_tracking_events(carrier_code);

-- ============================================
-- TABLE: carrier_webhook_registrations
-- ============================================
-- Purpose: Track webhook registrations with carriers

CREATE TABLE carrier_webhook_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Carrier
  carrier_code VARCHAR(20) NOT NULL,

  -- Webhook URL
  webhook_url TEXT NOT NULL,
  webhook_secret VARCHAR(255),  -- For signature verification

  -- Registration details
  carrier_webhook_id VARCHAR(255),  -- Carrier-assigned ID
  registered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_event_received_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT fk_webhook_reg_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, carrier_code)
);

CREATE INDEX idx_webhook_reg_carrier ON carrier_webhook_registrations(carrier_code);
CREATE INDEX idx_webhook_reg_active ON carrier_webhook_registrations(is_active);
```

**Webhook Handler Service:**

```typescript
@Injectable()
export class CarrierWebhookService {
  // Webhook endpoint handlers (one per carrier)
  @Post('/webhooks/tracking/fedex')
  async handleFedExWebhook(@Body() payload: any, @Headers() headers: any): Promise<void>;

  @Post('/webhooks/tracking/ups')
  async handleUPSWebhook(@Body() payload: any, @Headers() headers: any): Promise<void>;

  // Register webhook with carrier
  async registerWebhook(carrierCode: string): Promise<void>;

  // Process tracking event
  async processTrackingEvent(
    carrierCode: string,
    trackingNumber: string,
    eventData: any
  ): Promise<void>;

  // Notify interested parties (supplier, internal users)
  async notifyTrackingUpdate(
    shipmentId: string,
    eventType: string,
    eventDetails: any
  ): Promise<void>;
}
```

### 4.5 Notification System

**Database Tables:**

```sql
-- ============================================
-- TABLE: notification_templates
-- ============================================
-- Purpose: Email/SMS templates for supplier notifications

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Template identification
  template_code VARCHAR(50) NOT NULL,
  -- PO_ISSUED, PO_CHANGED, ASN_REMINDER, PERFORMANCE_ALERT, etc.
  template_name VARCHAR(255) NOT NULL,

  -- Template content
  subject_template TEXT NOT NULL,
  body_template_html TEXT NOT NULL,
  body_template_text TEXT,

  -- Supported channels
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,

  -- Variables available
  template_variables JSONB,
  -- ["vendor_name", "po_number", "delivery_date", etc.]

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT fk_notification_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, template_code)
);

-- ============================================
-- TABLE: notification_queue
-- ============================================
-- Purpose: Queue for outbound notifications

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Recipient
  vendor_id UUID,
  supplier_user_id UUID,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(50),

  -- Notification
  template_code VARCHAR(50) NOT NULL,
  notification_channel VARCHAR(20) NOT NULL,  -- EMAIL, SMS
  subject VARCHAR(500),
  body_html TEXT,
  body_text TEXT,

  -- Template variables
  template_data JSONB,

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',
  -- PENDING, SENDING, SENT, FAILED, CANCELLED

  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,

  -- Delivery tracking
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_notification_queue_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_notification_queue_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_notification_queue_user FOREIGN KEY (supplier_user_id) REFERENCES supplier_users(id)
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_vendor ON notification_queue(vendor_id);
```

---

## 5. Implementation Recommendations

### 5.1 Phased Implementation Plan

**Phase 1: Foundation (Weeks 1-3) - CRITICAL**

**Sprint 1.1: Supplier Authentication (Week 1)**
- Create `supplier_users` table with RLS policies
- Implement `SupplierAuthService` (mirror customer auth pattern)
- Create `supplier_activity_log` table
- Build supplier registration flow with email verification
- Implement JWT access/refresh token system
- Add account lockout after 5 failed attempts

**Sprint 1.2: Basic Portal API (Week 2)**
- Create GraphQL schema for supplier queries
- Implement `supplierDashboard` query (open POs, performance summary)
- Implement `supplierPurchaseOrders` query with filtering
- Implement `supplierPurchaseOrder` detail query
- Add basic PO acknowledgment mutation
- Create supplier portal frontend shell (React/Next.js)

**Sprint 1.3: Portal Security & Testing (Week 3)**
- Add supplier-specific guards and decorators
- Implement rate limiting for supplier API
- Add comprehensive activity logging
- Create unit tests for auth service
- Create integration tests for API layer
- Security audit and penetration testing

**Phase 2: Advanced Features (Weeks 4-6) - HIGH**

**Sprint 2.1: ASN (Advanced Ship Notice) (Week 4)**
- Create `advanced_ship_notices` table
- Create `asn_lines` table
- Implement `createAdvancedShipNotice` mutation
- Add ASN document upload (packing slip, BOL)
- Build ASN creation UI
- Trigger notifications on ASN receipt

**Sprint 2.2: Performance Dashboard (Week 5)**
- Expose vendor_performance data to suppliers
- Create `supplierPerformance` query
- Create `supplierPerformanceTrends` query
- Build performance dashboard UI (charts, scorecards)
- Add drill-down to monthly details
- Show alerts and action items

**Sprint 2.3: Document Management (Week 6)**
- Create `supplier_documents` table
- Implement document upload mutation
- Add S3/Azure Blob Storage integration
- Build document viewer UI
- Add virus scanning (ClamAV integration)
- Create document expiration notifications (certifications)

**Phase 3: Integration & Automation (Weeks 7-10) - HIGH**

**Sprint 3.1: EDI Infrastructure (Week 7-8)**
- Create `edi_documents` table
- Create `edi_partner_configurations` table
- Implement EDI 850 (PO) generator
- Implement EDI 855 (PO Ack) parser
- Implement EDI 856 (ASN) parser
- Build EDI monitoring dashboard

**Sprint 3.2: Real-Time Tracking Webhooks (Week 9)**
- Create `carrier_tracking_events` table
- Create `carrier_webhook_registrations` table
- Implement FedEx webhook handler
- Implement UPS webhook handler
- Register webhooks with carriers
- Build tracking event UI

**Sprint 3.3: Notification System (Week 10)**
- Create `notification_templates` table
- Create `notification_queue` table
- Implement email service integration (SendGrid/SES)
- Build template editor UI
- Create notification preference settings
- Implement background job for queue processing

**Phase 4: Analytics & Optimization (Weeks 11-12) - MEDIUM**

**Sprint 4.1: Supply Chain Analytics**
- Create supply chain visibility dashboard
- Implement lead time analytics
- Build exception management reports
- Create predictive delivery alerts
- Add multi-facility inventory visibility

**Sprint 4.2: Portal Enhancements**
- Add mobile-responsive design
- Implement push notifications (PWA)
- Add bulk PO acknowledgment
- Create supplier onboarding wizard
- Build self-service profile management

### 5.2 Database Migration Strategy

**Migration Sequence:**

```
V0.0.63__create_supplier_portal_authentication.sql
├── supplier_users table
├── supplier_activity_log table
└── Indexes, RLS policies

V0.0.64__create_asn_tables.sql
├── advanced_ship_notices table
├── asn_lines table
└── Indexes, RLS policies

V0.0.65__create_edi_infrastructure.sql
├── edi_documents table
├── edi_partner_configurations table
└── Indexes

V0.0.66__create_carrier_tracking_webhooks.sql
├── carrier_tracking_events table
├── carrier_webhook_registrations table
└── Indexes

V0.0.67__create_supplier_notification_system.sql
├── notification_templates table
├── notification_queue table
├── Seed default templates
└── Indexes
```

### 5.3 Technology Stack Recommendations

**Backend:**
- NestJS modules (already established pattern)
- GraphQL API layer (consistent with existing API)
- PostgreSQL with RLS (multi-tenant security)
- Bull Queue for async notification processing
- node-cron for scheduled jobs (ASN reminders, performance calculations)

**EDI Processing:**
- `node-x12` library for EDI parsing/generation
- AS2 protocol library for secure EDI transmission
- SFTP client for trading partner connectivity

**Real-Time Tracking:**
- Carrier-specific SDKs (FedEx, UPS, USPS APIs)
- Webhook signature verification
- Circuit breaker pattern for carrier API failures

**Notifications:**
- SendGrid or AWS SES for email
- Twilio for SMS (optional)
- Template engine (Handlebars or EJS)

**Frontend:**
- React/Next.js for supplier portal UI
- Apollo Client for GraphQL
- TailwindCSS for styling (consistent with existing UI)
- Chart.js or Recharts for performance dashboards

### 5.4 Security Considerations

**Authentication & Authorization:**
1. Separate authentication realm (supplier_users vs users vs customer_users)
2. JWT with short-lived access tokens (30 min) and refresh tokens (14 days)
3. MFA support for high-value suppliers (TOTP)
4. Account lockout after 5 failed attempts
5. Email verification required before portal access

**API Security:**
1. Rate limiting per supplier (100 req/min)
2. Row-Level Security (RLS) on all tables
3. Comprehensive activity logging
4. API key rotation for EDI partners
5. Webhook signature verification (HMAC-SHA256)

**Data Privacy:**
1. Suppliers can only see their own POs and data
2. Tenant isolation via RLS policies
3. GDPR compliance (right to deletion, data export)
4. Audit trail for all supplier actions

**Network Security:**
1. HTTPS required (TLS 1.3)
2. AS2 encryption for EDI transmission
3. SFTP with public key authentication
4. Firewall rules for webhook endpoints

### 5.5 Testing Strategy

**Unit Tests:**
- Authentication service (registration, login, MFA)
- EDI parser/generator (validate X12 format)
- Notification template rendering
- Business logic for PO acknowledgment, ASN creation

**Integration Tests:**
- End-to-end supplier registration and login flow
- PO query with RLS enforcement (no cross-tenant data leakage)
- ASN creation with document upload
- Webhook processing pipeline

**Load Tests:**
- Concurrent supplier logins (100+ simultaneous users)
- Bulk PO notifications (1000+ emails/min)
- Webhook burst handling (50+ tracking events/sec)

**Security Tests:**
- Penetration testing for authentication bypass attempts
- SQL injection testing on GraphQL queries
- Cross-tenant data access attempts
- API rate limit enforcement

---

## 6. ROI & Business Value

### 6.1 Quantifiable Benefits

**Operational Efficiency:**
- **50% reduction in PO inquiries via phone/email** (suppliers self-service)
- **30% reduction in receiving errors** (ASN provides advance notice)
- **40% faster invoice processing** (EDI 810 automation)
- **60% reduction in manual data entry** (EDI integration)

**Supply Chain Performance:**
- **20% improvement in on-time delivery** (better supplier visibility)
- **15% reduction in emergency expedites** (real-time tracking alerts)
- **25% reduction in stockouts** (improved lead time accuracy)

**Supplier Relationship:**
- **Improved supplier satisfaction** (self-service portal)
- **Faster onboarding** (automated registration)
- **Better collaboration** (transparent performance metrics)

### 6.2 Cost Savings

**Labor Savings:**
- Reduce 2 FTE equivalent in purchasing admin (manual PO follow-up)
- Reduce 1 FTE equivalent in receiving (ASN pre-processing)
- Annual savings: $150,000 - $200,000

**Technology Savings:**
- Replace manual EDI VAN fees with automated AS2 ($10,000/year)
- Reduce phone call volume to suppliers ($5,000/year)

**Operational Savings:**
- Reduce expedited shipping due to better planning ($25,000/year)
- Reduce inventory holding costs via JIT delivery ($50,000/year)

**Total Annual ROI:** $240,000 - $290,000

### 6.3 Competitive Advantage

**Industry Leadership:**
- Print industry suppliers expect EDI and portal access (industry standard)
- Differentiation from competitors still using manual processes
- Attract high-quality suppliers who prefer automated systems

**Scalability:**
- Portal scales to 1000+ suppliers without additional staffing
- EDI enables rapid onboarding of new suppliers
- Real-time tracking supports multi-facility expansion

---

## 7. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Supplier adoption resistance** | Medium | Medium | Phased rollout, training materials, dedicated support |
| **EDI complexity and testing** | High | High | Start with 2-3 pilot suppliers, extensive testing, use EDI consultant |
| **Carrier API downtime** | Medium | Medium | Implement circuit breaker, fallback to manual entry |
| **Security vulnerabilities** | High | Low | Penetration testing, security audit, rate limiting |
| **Data migration issues** | Medium | Low | Comprehensive data validation, rollback plan |
| **Integration delays** | Medium | Medium | Buffer time in project plan, parallel development |

---

## 8. Success Metrics & KPIs

**Supplier Portal Adoption:**
- Target: 80% of active suppliers registered within 6 months
- Target: 70% of POs acknowledged via portal within 3 months
- Target: 60% of shipments with ASN within 6 months

**Operational Efficiency:**
- Metric: PO inquiry volume (phone/email)
- Target: 50% reduction within 3 months

**Data Quality:**
- Metric: ASN accuracy rate
- Target: 95% accuracy (ASN qty matches received qty)

**System Performance:**
- Metric: Portal response time
- Target: <500ms for 95th percentile
- Metric: API availability
- Target: 99.5% uptime

**Supplier Satisfaction:**
- Metric: Supplier NPS (Net Promoter Score)
- Target: NPS > 40 within 6 months
- Survey: Quarterly supplier satisfaction survey

---

## 9. Dependencies & Prerequisites

**Technical Dependencies:**
1. Existing vendor/procurement tables (✓ COMPLETE)
2. Existing carrier shipping integration (✓ COMPLETE)
3. Email service integration (PENDING - SendGrid/SES)
4. Document storage (PENDING - S3/Azure Blob)
5. Background job queue (PENDING - Bull/BullMQ)

**Business Dependencies:**
1. Supplier contact data cleanup (ensure valid emails)
2. EDI partner agreements (legal/procurement)
3. Carrier API credentials and webhook setup
4. Notification email templates approval
5. Training materials for suppliers

**Infrastructure Dependencies:**
1. HTTPS certificate and domain for supplier portal
2. Webhook endpoint URLs (publicly accessible)
3. SFTP server for EDI partners (if needed)
4. Email sending limits increase (SendGrid/SES)

---

## 10. Conclusion & Next Steps

### 10.1 Summary

The **Supply Chain Visibility & Supplier Portal** is a **HIGH PRIORITY** feature that will:

1. **Enable self-service** for 100+ suppliers to view POs, create ASNs, and track performance
2. **Automate data exchange** via EDI (850/855/856/810) to reduce manual entry by 60%
3. **Improve supply chain visibility** via real-time carrier tracking and exception alerts
4. **Strengthen supplier relationships** through transparent performance scorecards
5. **Deliver measurable ROI** of $240K-$290K annually

### 10.2 Recommended Immediate Actions

**Week 1:**
1. ✅ Complete research (THIS DOCUMENT)
2. Create migration V0.0.63 (supplier_users table)
3. Implement SupplierAuthService (mirror customer auth pattern)
4. Set up test supplier accounts for QA

**Week 2:**
5. Build GraphQL schema for supplier queries
6. Implement dashboard and PO listing queries
7. Create supplier portal frontend shell
8. Deploy to staging environment

**Week 3:**
9. Security audit and penetration testing
10. Pilot with 2-3 friendly suppliers
11. Gather feedback and iterate
12. Plan Phase 2 (ASN, Performance Dashboard)

### 10.3 Open Questions for Product Owner

1. **EDI Priority:** Which suppliers require EDI vs. portal-only access?
2. **Pilot Suppliers:** Which 2-3 suppliers should we pilot with?
3. **Notification Frequency:** Daily digest or real-time alerts for PO updates?
4. **Document Storage:** AWS S3 or Azure Blob Storage preference?
5. **Mobile App:** Is a native mobile app required or is mobile web sufficient?

---

## Appendices

### Appendix A: Related Requirements

- REQ-STRATEGIC-AUTO-1766657618088: Vendor Scorecards (COMPLETE)
- REQ-STRATEGIC-AUTO-1766676891764: PO Approval Workflow (COMPLETE)
- REQ-STRATEGIC-AUTO-1767066329941: Carrier Shipping Integrations (COMPLETE)
- REQ-STRATEGIC-AUTO-1767048328659: Customer Portal & Self-Service Ordering (COMPLETE)

### Appendix B: Reference Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUPPLIER PORTAL                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ Dashboard  │  │ PO Viewer  │  │ ASN Form   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ GraphQL API (JWT Auth)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVICES                           │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ SupplierAuth     │  │ SupplierPortal   │                    │
│  │ Service          │  │ Service          │                    │
│  └──────────────────┘  └──────────────────┘                    │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ EDIProcessing    │  │ CarrierWebhook   │                    │
│  │ Service          │  │ Service          │                    │
│  └──────────────────┘  └──────────────────┘                    │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Notification     │  │ DocumentStorage  │                    │
│  │ Service          │  │ Service          │                    │
│  └──────────────────┘  └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ PostgreSQL with RLS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE TABLES                            │
│  • supplier_users           • purchase_orders                   │
│  • supplier_activity_log    • purchase_order_lines              │
│  • advanced_ship_notices    • vendor_performance                │
│  • asn_lines                • vendor_performance_alerts         │
│  • edi_documents            • carrier_tracking_events           │
│  • edi_partner_configs      • notification_queue                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ External Integrations
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Carrier APIs │  │ Email/SMS    │  │ EDI Partners │         │
│  │ (Webhooks)   │  │ (SendGrid)   │  │ (AS2/SFTP)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Appendix C: Sample EDI 850 Purchase Order

```
ISA*00*          *00*          *ZZ*BUYER123       *ZZ*VENDOR456      *251230*1435*U*00401*000000001*0*P*>
GS*PO*BUYER123*VENDOR456*20251230*1435*1*X*004010
ST*850*0001
BEG*00*NE*PO123456**20251230
REF*DP*Department 42
DTM*002*20260105
N1*ST*Acme Printing Facility
N3*123 Industrial Parkway
N4*Chicago*IL*60601*US
PO1*1*1000*SH*10.50*EA*BP*PAPER-80LB-GLOSS*VN*VENDOR-SKU-123
PID*F****80lb Gloss Text, 25x38, Long Grain
DTM*002*20260105
PO1*2*500*RL*45.00*EA*BP*LABEL-STOCK-4X6*VN*VENDOR-SKU-456
PID*F****Label Stock, 4x6, Thermal Transfer
DTM*002*20260110
CTT*2
SE*14*0001
GE*1*1
IEA*1*000000001
```

---

**END OF RESEARCH REPORT**
