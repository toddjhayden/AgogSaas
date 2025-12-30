// Customer Portal TypeScript Types
// Generated for REQ-STRATEGIC-AUTO-1767066329943

// Customer User Types
export interface CustomerUser {
  id: string;
  customerId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: CustomerUserRole;
  mfaEnabled: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  preferredLanguage: string;
  timezone: string;
  lastLoginAt: string | null;
  customer?: {
    id: string;
    customerName: string;
    customerCode: string;
  };
}

export enum CustomerUserRole {
  CUSTOMER_ADMIN = 'CUSTOMER_ADMIN',
  CUSTOMER_USER = 'CUSTOMER_USER',
  APPROVER = 'APPROVER',
}

// Authentication Types
export interface CustomerAuthPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: CustomerUser;
  customer: {
    id: string;
    customerName: string;
    customerCode: string;
  };
  permissions: string[];
}

export interface MFAEnrollmentPayload {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

// Order Types
export interface CustomerOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: SalesOrderStatus;
  totalAmount: number;
  currencyCode: string;
  requestedDeliveryDate: string | null;
  promisedDeliveryDate: string | null;
  deliveryDate: string | null;
  trackingNumber: string | null;
  customerPoNumber: string | null;
  lines?: CustomerOrderLine[];
}

export interface CustomerOrderLine {
  lineNumber: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
}

export enum SalesOrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  INVOICED = 'INVOICED',
  CANCELLED = 'CANCELLED',
}

export interface CustomerOrdersResult {
  orders: CustomerOrder[];
  total: number;
  hasMore: boolean;
}

// Quote Types
export interface CustomerQuote {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  status: QuoteStatus;
  expiresAt: string;
  totalAmount: number;
  currencyCode: string;
  customerPoNumber: string | null;
  lines?: CustomerQuoteLine[];
}

export interface CustomerQuoteLine {
  lineNumber: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
}

export interface CustomerQuotesResult {
  quotes: CustomerQuote[];
  total: number;
  hasMore: boolean;
}

// Proof Types
export interface Proof {
  id: string;
  orderId: string;
  proofUrl: string;
  version: number;
  status: ProofStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  revisionNotes: string | null;
  customerComments: string | null;
}

export enum ProofStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  SUPERSEDED = 'SUPERSEDED',
}

// Artwork File Types
export interface ArtworkFile {
  id: string;
  orderId: string | null;
  quoteId: string | null;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  virusScanStatus: VirusScanStatus;
  uploadedAt: string;
}

export enum VirusScanStatus {
  PENDING = 'PENDING',
  SCANNING = 'SCANNING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  SCAN_FAILED = 'SCAN_FAILED',
}

export interface ArtworkUploadUrl {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
}

// Product Types
export interface Product {
  id: string;
  productName: string;
  productCode: string;
  category: string | null;
  description: string | null;
  unitPrice: number;
  currencyCode: string;
}

// Input Types
export interface CustomerQuoteRequestInput {
  productId: string;
  quantity: number;
  specifications?: Record<string, any>;
  artworkFileUrl?: string;
  requestedDeliveryDate?: string;
  notes?: string;
  customerPoNumber?: string;
}

export interface CustomerProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  preferredLanguage?: string;
  timezone?: string;
  notificationPreferences?: Record<string, any>;
}
