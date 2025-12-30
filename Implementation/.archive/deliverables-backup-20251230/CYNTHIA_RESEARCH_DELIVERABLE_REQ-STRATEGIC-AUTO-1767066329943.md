# Research Deliverable: Customer Portal Frontend Implementation
## REQ-STRATEGIC-AUTO-1767066329943

**Prepared by:** Cynthia (Research Analyst)
**Date:** 2025-12-29
**Assigned to:** Marcus (Frontend Developer)
**Status:** COMPLETE

---

## Executive Summary

This research deliverable provides comprehensive technical specifications for implementing the **Customer Portal Frontend** for the print industry ERP application. The backend infrastructure is fully implemented (REQ-STRATEGIC-AUTO-1767048328659), providing a complete GraphQL API with authentication, order management, and self-service capabilities.

**Current Status:**
- ✅ **Backend Complete:** Full GraphQL API, database schema, authentication services
- ✅ **Internal ERP Frontend:** React + TypeScript + Apollo Client architecture established
- ⚠️ **Customer Portal Frontend:** Not yet implemented (this requirement)

**Implementation Scope:**
This requirement focuses on building the customer-facing frontend interface that enables print customers to:
- Authenticate securely (login, register, verify email, password reset)
- View order history and track shipments
- Request quotes and upload artwork
- Approve digital proofs
- Manage profile and preferences

---

## Table of Contents

1. [Backend Infrastructure Analysis](#1-backend-infrastructure-analysis)
2. [Frontend Architecture Overview](#2-frontend-architecture-overview)
3. [Technical Specifications](#3-technical-specifications)
4. [Page Requirements](#4-page-requirements)
5. [Component Requirements](#5-component-requirements)
6. [GraphQL Integration](#6-graphql-integration)
7. [Security & Authentication](#7-security--authentication)
8. [UX/UI Guidelines](#8-uxui-guidelines)
9. [Internationalization (i18n)](#9-internationalization-i18n)
10. [Testing Strategy](#10-testing-strategy)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [References](#12-references)

---

## 1. Backend Infrastructure Analysis

### 1.1 Database Schema (Fully Implemented)

**Migration:** `V0.0.43__create_customer_portal_tables.sql`

The backend provides the following tables:

#### **customer_users**
Customer portal user accounts with the following features:
- Multi-factor authentication (MFA) support via TOTP
- Account lockout after 5 failed login attempts (30-minute lockout)
- Email verification workflow
- Password reset tokens
- SSO support (Google, Microsoft)
- Three role types: `CUSTOMER_ADMIN`, `CUSTOMER_USER`, `APPROVER`
- GDPR-compliant fields (marketing consent, data retention)
- Preferences (language, timezone, notification settings)

**Key Fields:**
```sql
id, customer_id, tenant_id, email, password_hash,
first_name, last_name, phone, role, mfa_enabled,
is_email_verified, preferred_language, timezone,
notification_preferences, last_login_at
```

**File Reference:** `backend/migrations/V0.0.43__create_customer_portal_tables.sql:20-94`

#### **refresh_tokens**
Secure JWT refresh token storage:
- Short-lived access tokens (30 minutes)
- Long-lived refresh tokens (14 days)
- Token rotation on refresh
- Revocable tokens with reasons (PASSWORD_CHANGE, MANUAL_LOGOUT, SECURITY_BREACH)
- Session metadata (IP, user agent, device fingerprint)

**File Reference:** `backend/migrations/V0.0.43__create_customer_portal_tables.sql:124-159`

#### **artwork_files**
Customer-uploaded artwork for quotes and orders:
- Virus scanning workflow (PENDING → SCANNING → CLEAN/INFECTED)
- S3/Azure storage with presigned URLs
- File integrity verification (SHA-256 hash)
- Automatic expiration (90-day lifecycle)
- Supported formats: PDF, JPG, PNG, AI, EPS, PSD, TIF

**File Reference:** `backend/migrations/V0.0.43__create_customer_portal_tables.sql:185-232`

#### **proofs**
Digital proof approval workflow:
- Version tracking with revision history
- Status workflow: PENDING_REVIEW → APPROVED/REVISION_REQUESTED → SUPERSEDED
- Digital signature capture
- Email notification tracking (sent, opened)
- Customer feedback and comments

**File Reference:** `backend/migrations/V0.0.43__create_customer_portal_tables.sql:257-302`

#### **customer_activity_log**
Comprehensive audit log for security and compliance:
- Activity types: LOGIN, LOGOUT, LOGIN_FAILED, VIEW_ORDER, APPROVE_QUOTE, etc.
- Anomaly detection flags (unusual IP, rapid requests)
- Geolocation tracking
- Session metadata
- GDPR compliance support

**File Reference:** `backend/migrations/V0.0.43__create_customer_portal_tables.sql:327-367`

### 1.2 GraphQL API (Fully Implemented)

**Schema:** `backend/src/graphql/schema/customer-portal.graphql`

#### **Authentication Mutations**
```graphql
# Registration & Login
customerRegister(customerCode, email, password, firstName, lastName): CustomerAuthPayload!
customerLogin(email, password, mfaCode?): CustomerAuthPayload!
customerRefreshToken(refreshToken): CustomerAuthPayload!
customerLogout: Boolean!

# Password Management
customerRequestPasswordReset(email): Boolean!
customerResetPassword(token, newPassword): Boolean!
customerChangePassword(oldPassword, newPassword): Boolean!

# Email Verification
customerVerifyEmail(token): Boolean!
customerResendVerificationEmail: Boolean!

# MFA Management
customerEnrollMFA: MFAEnrollmentPayload!
customerVerifyMFA(code): Boolean!
customerDisableMFA(password): Boolean!

# Profile Management
customerUpdateProfile(input: CustomerProfileUpdateInput!): CustomerUser!
```

**File Reference:** `backend/src/graphql/schema/customer-portal.graphql:126-227`

#### **Self-Service Ordering Mutations**
```graphql
# Quote Management
customerRequestQuote(input: CustomerQuoteRequestInput!): Quote!
customerApproveQuote(quoteId, purchaseOrderNumber?, requestedDeliveryDate?): SalesOrder!
customerRejectQuote(quoteId, reason?): Quote!

# Reordering
customerReorder(originalOrderId, quantity?, requestedDeliveryDate?): SalesOrder!

# Artwork Management
customerRequestArtworkUpload(fileName, fileSize, fileType, quoteId?, orderId?): ArtworkUploadUrl!
customerConfirmArtworkUpload(fileId, storageUrl): ArtworkFile!

# Proof Approval
customerApproveProof(proofId, comments?): Proof!
customerRequestProofRevision(proofId, revisionNotes): Proof!
```

**File Reference:** `backend/src/graphql/schema/customer-portal.graphql:236-301`

#### **Customer Portal Queries**
```graphql
# User & Account
customerMe: CustomerUser!

# Orders
customerOrders(status?, dateFrom?, dateTo?, limit?, offset?): CustomerOrdersResult!
customerOrder(orderNumber): SalesOrder!

# Quotes
customerQuotes(status?, limit?, offset?): CustomerQuotesResult!
customerQuote(quoteNumber): Quote!

# Products & Catalog
customerProducts(category?, search?, limit?): [Product!]!

# Proofs
customerPendingProofs: [Proof!]!
customerOrderProofs(orderNumber): [Proof!]!

# Artwork Files
customerArtworkFiles(quoteId?, orderId?): [ArtworkFile!]!
```

**File Reference:** `backend/src/graphql/schema/customer-portal.graphql:307-394`

### 1.3 Backend Services (Fully Implemented)

#### **CustomerAuthService**
Authentication and authorization service for customer users:
- Registration with customer code validation
- Login with MFA support
- JWT token generation (access + refresh)
- Password complexity validation
- Account lockout logic
- Email verification workflow
- Password reset workflow

**File Reference:** `backend/src/modules/customer-auth/customer-auth.service.ts:37-100`

#### **CustomerPortalResolver**
GraphQL resolver implementing all customer portal mutations and queries.

**File Reference:** `backend/src/modules/customer-portal/customer-portal.resolver.ts:1-77`

#### **Security Features**
- **Row Level Security (RLS):** All tables enforce tenant isolation
- **JWT Strategy:** 30-minute access tokens, 14-day refresh tokens
- **bcrypt Password Hashing:** Salt rounds ≥ 10
- **MFA Support:** TOTP via authenticator apps
- **Rate Limiting:** Account lockout after 5 failed attempts

---

## 2. Frontend Architecture Overview

### 2.1 Existing Internal ERP Architecture

The application already has a well-established frontend architecture:

**Tech Stack:**
- React 18 with TypeScript
- Apollo Client for GraphQL
- React Router v6 for routing
- Tailwind CSS for styling
- react-i18next for internationalization
- Zustand for state management
- react-hot-toast for notifications
- Lucide React for icons

**Key Files:**
- `frontend/src/App.tsx` - Main application router (40 pages, internal ERP routes)
- `frontend/src/components/layout/MainLayout.tsx` - Internal layout wrapper
- `frontend/src/graphql/client.ts` - Apollo Client configuration
- `frontend/src/store/appStore.ts` - Zustand state management

**File References:**
- `frontend/src/App.tsx:1-113` (Routing structure)
- `frontend/src/components/layout/MainLayout.tsx:1-18` (Layout pattern)
- `frontend/src/graphql/client.ts:1-15` (Apollo setup)

### 2.2 Recommended Customer Portal Architecture

**Decision 1: Separate Customer Portal Routes**
- Implement customer portal under `/portal/*` routes
- Separate from internal `/app/*` or root routes
- **Rationale:** Clear security boundary between employee and customer experiences

**Decision 2: Dedicated Apollo Client for Customer Portal**
- Create `customerPortalClient.ts` with separate JWT authentication headers
- **Rationale:** Prevent token conflicts between internal and customer auth realms
- **Pattern:** Similar to existing `apolloClient` but with customer-specific auth logic

**Decision 3: Customer Authentication Context**
- Create `CustomerAuthContext.tsx` using React Context API
- Store customer user, tokens, and permissions
- Provide `useCustomerAuth()` hook for easy access
- **Rationale:** Centralized auth state management, consistent with React best practices

**Decision 4: Protected Route Component**
- Create `CustomerProtectedRoute.tsx` wrapper component
- Redirects unauthenticated users to login page
- **Pattern:** Similar to common React Router auth patterns

### 2.3 Recommended Component Hierarchy

```
App.tsx
├── Internal ERP Routes (/dashboard, /operations, etc.)
│   └── MainLayout
│       └── Internal pages (existing - 40+ pages)
│
└── Customer Portal Routes (/portal/*)
    ├── Public Routes (no auth required)
    │   ├── /portal/login - CustomerLoginPage
    │   ├── /portal/register - CustomerRegisterPage
    │   ├── /portal/verify-email - VerifyEmailPage
    │   ├── /portal/forgot-password - ForgotPasswordPage
    │   └── /portal/reset-password - ResetPasswordPage
    │
    └── Protected Routes (CustomerProtectedRoute wrapper)
        └── CustomerPortalLayout
            ├── /portal/dashboard - CustomerDashboard
            ├── /portal/orders - CustomerOrdersPage
            ├── /portal/orders/:id - CustomerOrderDetailPage
            ├── /portal/quotes - CustomerQuotesPage
            ├── /portal/quotes/:id - CustomerQuoteDetailPage
            ├── /portal/request-quote - RequestQuotePage
            ├── /portal/proofs - PendingProofsPage
            ├── /portal/profile - CustomerProfilePage
            └── /portal/settings - CustomerSettingsPage
```

---

## 3. Technical Specifications

### 3.1 Required NPM Packages (Already Installed)

All necessary dependencies are already installed in the project:

```json
// From frontend/package.json
"@apollo/client": "^3.8.8",
"react": "^18.2.0",
"react-router-dom": "^6.20.1",
"react-i18next": "^13.5.0",
"zustand": "^4.4.7",
"react-hot-toast": "^2.4.1",
"lucide-react": "^0.293.0",
"tailwindcss": "^3.3.5"
```

**No additional packages required!**

### 3.2 File Structure

```
frontend/src/
├── pages/
│   └── customer-portal/
│       ├── CustomerLoginPage.tsx          # NEW
│       ├── CustomerRegisterPage.tsx       # NEW
│       ├── VerifyEmailPage.tsx            # NEW
│       ├── ForgotPasswordPage.tsx         # NEW
│       ├── ResetPasswordPage.tsx          # NEW
│       ├── CustomerDashboard.tsx          # NEW
│       ├── CustomerOrdersPage.tsx         # NEW
│       ├── CustomerOrderDetailPage.tsx    # NEW
│       ├── CustomerQuotesPage.tsx         # NEW
│       ├── CustomerQuoteDetailPage.tsx    # NEW
│       ├── RequestQuotePage.tsx           # NEW
│       ├── PendingProofsPage.tsx          # NEW
│       ├── CustomerProfilePage.tsx        # NEW
│       └── CustomerSettingsPage.tsx       # NEW
│
├── components/
│   └── customer-portal/
│       ├── CustomerPortalLayout.tsx       # NEW - Layout wrapper
│       ├── CustomerProtectedRoute.tsx     # NEW - Auth guard
│       ├── CustomerHeader.tsx             # NEW - Portal header
│       ├── CustomerSidebar.tsx            # NEW - Portal navigation
│       ├── OrderStatusBadge.tsx           # NEW - Status display
│       ├── QuoteCard.tsx                  # NEW - Quote preview card
│       ├── OrderCard.tsx                  # NEW - Order preview card
│       ├── ProofViewer.tsx                # NEW - Proof display
│       ├── ArtworkUploader.tsx            # NEW - File upload
│       └── CustomerBreadcrumb.tsx         # NEW - Navigation breadcrumb
│
├── contexts/
│   └── CustomerAuthContext.tsx            # NEW - Auth state management
│
├── graphql/
│   ├── customerPortalClient.ts            # NEW - Dedicated Apollo client
│   ├── mutations/
│   │   └── customerAuth.ts                # NEW - Auth mutations
│   ├── queries/
│   │   ├── customerOrders.ts              # NEW - Order queries
│   │   ├── customerQuotes.ts              # NEW - Quote queries
│   │   └── customerProofs.ts              # NEW - Proof queries
│   └── types/
│       └── customerPortal.ts              # NEW - TypeScript types
│
├── hooks/
│   └── useCustomerAuth.ts                 # NEW - Auth hook (optional if using context)
│
└── i18n/
    └── locales/
        ├── en-US.json                     # UPDATE - Add customer portal translations
        └── zh-CN.json                     # UPDATE - Add customer portal translations
```

### 3.3 TypeScript Types

**Create:** `frontend/src/graphql/types/customerPortal.ts`

```typescript
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
  deliveryDate: string | null;
  trackingNumber: string | null;
  lines: CustomerOrderLine[];
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
  lines: CustomerQuoteLine[];
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
```

---

## 4. Page Requirements

### 4.1 Authentication Pages (Public Routes)

#### **CustomerLoginPage** (`/portal/login`)

**Purpose:** Allow customers to log in to their portal account.

**UI Components:**
- Email input (type: email, required, autocomplete)
- Password input (type: password, required, show/hide toggle)
- MFA code input (conditional, shown if MFA enabled)
- "Remember me" checkbox (optional)
- "Forgot password?" link
- "Log in" button (primary action)
- "Don't have an account? Register" link
- Loading spinner during authentication
- Error message display (invalid credentials, account locked, etc.)

**Behavior:**
1. User enters email and password
2. On submit, call `customerLogin` mutation
3. If MFA enabled, show MFA code input
4. On success, store tokens in localStorage or sessionStorage
5. Redirect to `/portal/dashboard`
6. On failure, display error message (e.g., "Invalid credentials", "Account locked for 30 minutes")

**GraphQL Mutation:**
```graphql
mutation CustomerLogin($email: String!, $password: String!, $mfaCode: String) {
  customerLogin(email: $email, password: $password, mfaCode: $mfaCode) {
    accessToken
    refreshToken
    expiresAt
    user {
      id
      email
      firstName
      lastName
      role
      mfaEnabled
    }
    customer {
      id
      customerName
      customerCode
    }
    permissions
  }
}
```

**Error Handling:**
- Invalid credentials → "Invalid email or password"
- Account locked → "Account locked due to too many failed login attempts. Please try again in 30 minutes."
- Email not verified → "Please verify your email address. Check your inbox for the verification link."
- MFA required → Show MFA input field

**Accessibility:**
- Keyboard navigation support
- Screen reader labels
- Focus management
- Error announcements

**File Reference (Pattern):** `frontend/src/pages/PurchaseOrdersPage.tsx:1-150` (React component pattern)

---

#### **CustomerRegisterPage** (`/portal/register`)

**Purpose:** Allow new customers to create an account.

**UI Components:**
- Customer code input (required, validation against backend)
- Email input (type: email, required)
- Password input (type: password, required, strength meter)
- Confirm password input (must match password)
- First name input (required)
- Last name input (required)
- Phone input (optional)
- Terms & conditions checkbox (required)
- "Create account" button (primary action)
- "Already have an account? Log in" link
- Loading spinner during registration
- Error message display
- Success message with email verification instructions

**Behavior:**
1. User fills in registration form
2. Validate password complexity (backend enforces: min 8 chars, uppercase, lowercase, number, special char)
3. On submit, call `customerRegister` mutation
4. On success, show "Registration successful! Please check your email to verify your account."
5. Redirect to `/portal/verify-email` with email pre-filled
6. On failure, display error message (e.g., "Email already registered", "Invalid customer code")

**GraphQL Mutation:**
```graphql
mutation CustomerRegister(
  $customerCode: String!
  $email: String!
  $password: String!
  $firstName: String!
  $lastName: String!
) {
  customerRegister(
    customerCode: $customerCode
    email: $email
    password: $password
    firstName: $firstName
    lastName: $lastName
  ) {
    accessToken
    refreshToken
    expiresAt
    user {
      id
      email
      firstName
      lastName
    }
  }
}
```

**Validation Rules:**
- Customer code: Required, alphanumeric
- Email: Valid email format, unique
- Password: Min 8 chars, uppercase, lowercase, number, special char
- Confirm password: Must match password
- First name: Required, 2-100 chars
- Last name: Required, 2-100 chars
- Terms: Must be checked

**Error Messages:**
- "Invalid customer code. Please check with your sales representative."
- "This email is already registered. Please log in or use a different email."
- "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
- "Passwords do not match."

---

#### **VerifyEmailPage** (`/portal/verify-email`)

**Purpose:** Verify customer email address via token from email link.

**UI Components:**
- Message: "Verifying your email address..."
- Success message: "Email verified successfully! You can now log in."
- Error message: "Invalid or expired verification link. Please request a new one."
- "Resend verification email" button (if token invalid)
- "Go to login" button (on success)
- Loading spinner during verification

**Behavior:**
1. Page reads `?token=xxx` from URL query params
2. On mount, call `customerVerifyEmail` mutation with token
3. On success, show success message and "Go to login" button
4. On failure, show error message and "Resend verification email" option

**GraphQL Mutation:**
```graphql
mutation CustomerVerifyEmail($token: String!) {
  customerVerifyEmail(token: $token)
}
```

---

#### **ForgotPasswordPage** (`/portal/forgot-password`)

**Purpose:** Request password reset email.

**UI Components:**
- Email input (type: email, required)
- "Send reset link" button (primary action)
- Success message: "Password reset link sent! Check your email."
- Error message display
- "Back to login" link

**Behavior:**
1. User enters email
2. On submit, call `customerRequestPasswordReset` mutation
3. Always show success message (even if email doesn't exist - security best practice)
4. Email contains link to `/portal/reset-password?token=xxx`

**GraphQL Mutation:**
```graphql
mutation CustomerRequestPasswordReset($email: String!) {
  customerRequestPasswordReset(email: $email)
}
```

---

#### **ResetPasswordPage** (`/portal/reset-password`)

**Purpose:** Reset password using token from email.

**UI Components:**
- New password input (type: password, required, strength meter)
- Confirm password input (must match)
- "Reset password" button (primary action)
- Success message: "Password reset successfully! You can now log in."
- Error message: "Invalid or expired reset link. Please request a new one."
- "Request new reset link" button (if token invalid)

**Behavior:**
1. Page reads `?token=xxx` from URL query params
2. User enters new password
3. On submit, call `customerResetPassword` mutation
4. On success, redirect to `/portal/login` with success message

**GraphQL Mutation:**
```graphql
mutation CustomerResetPassword($token: String!, $newPassword: String!) {
  customerResetPassword(token: $token, newPassword: $newPassword)
}
```

---

### 4.2 Protected Pages (Require Authentication)

#### **CustomerDashboard** (`/portal/dashboard`)

**Purpose:** Main landing page after login, showing overview of customer activity.

**UI Components:**
- Welcome message: "Welcome back, [First Name]!"
- Quick stats cards:
  - Active orders count
  - Pending quotes count
  - Pending proofs count
  - Recent orders (last 5)
- Call-to-action buttons:
  - "Request a Quote" (primary)
  - "View All Orders"
  - "View Pending Proofs"
- Recent activity timeline (optional)

**GraphQL Queries:**
```graphql
query CustomerDashboard {
  customerMe {
    id
    firstName
    lastName
    email
    customer {
      customerName
    }
  }

  customerOrders(limit: 5, offset: 0) {
    orders {
      id
      orderNumber
      orderDate
      status
      totalAmount
      currencyCode
    }
    total
  }

  customerQuotes(limit: 5, offset: 0) {
    quotes {
      id
      quoteNumber
      status
      expiresAt
    }
    total
  }

  customerPendingProofs {
    id
    orderId
    version
    status
  }
}
```

**Design Pattern:** Similar to `ExecutiveDashboard.tsx` with KPI cards and summary views.

**File Reference (Pattern):** `frontend/src/pages/ExecutiveDashboard.tsx:1-100`

---

#### **CustomerOrdersPage** (`/portal/orders`)

**Purpose:** View all customer orders with filtering and search.

**UI Components:**
- Page title: "My Orders"
- Search input (search by order number, product name)
- Status filter dropdown (All, Confirmed, In Production, Shipped, Delivered)
- Date range filter
- Orders table with columns:
  - Order number (clickable link to detail page)
  - Order date
  - Status badge (color-coded)
  - Total amount
  - Delivery date
  - Actions (View details, Track shipment)
- Pagination (limit: 50 per page)
- Empty state: "You haven't placed any orders yet. Request a quote to get started!"

**GraphQL Query:**
```graphql
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
      trackingNumber
    }
    total
    hasMore
  }
}
```

**Design Pattern:** Similar to `PurchaseOrdersPage.tsx` with DataTable component.

**File Reference (Pattern):** `frontend/src/pages/PurchaseOrdersPage.tsx:44-200`

---

#### **CustomerOrderDetailPage** (`/portal/orders/:orderNumber`)

**Purpose:** View detailed information about a specific order.

**UI Components:**
- Order header:
  - Order number (large, prominent)
  - Status badge
  - Order date
  - Delivery date
- Order details section:
  - Customer PO number
  - Billing address
  - Shipping address
  - Tracking information (if shipped)
- Line items table:
  - Product name
  - Quantity
  - Unit price
  - Total price
  - Status per line
- Order totals:
  - Subtotal
  - Tax
  - Shipping
  - Total
- Actions:
  - "Reorder" button (creates new order from this one)
  - "Download Invoice" button (if invoiced)
  - "Track Shipment" button (if tracking available)
- Proof approval section (if proofs available)
- Artwork files section (uploaded files)

**GraphQL Query:**
```graphql
query CustomerOrderDetail($orderNumber: String!) {
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

  customerOrderProofs(orderNumber: $orderNumber) {
    id
    proofUrl
    version
    status
    approvedAt
  }

  customerArtworkFiles(orderId: $orderId) {
    id
    fileName
    fileUrl
    uploadedAt
  }
}
```

**Design Pattern:** Similar to `PurchaseOrderDetailPageEnhanced.tsx`.

**File Reference (Pattern):** `frontend/src/pages/PurchaseOrderDetailPageEnhanced.tsx:1-200`

---

#### **CustomerQuotesPage** (`/portal/quotes`)

**Purpose:** View all customer quotes with filtering.

**UI Components:**
- Page title: "My Quotes"
- Status filter tabs: All, Pending Approval, Approved, Expired
- Quotes grid/list:
  - Quote number
  - Quote date
  - Expiration date (highlight if expiring soon)
  - Status badge
  - Total amount
  - Actions (View, Approve, Reject)
- "Request New Quote" button (primary action)
- Empty state: "You have no quotes. Request a quote to get started!"

**GraphQL Query:**
```graphql
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
      lines {
        productName
        quantity
      }
    }
    total
    hasMore
  }
}
```

---

#### **CustomerQuoteDetailPage** (`/portal/quotes/:quoteNumber`)

**Purpose:** View quote details and approve/reject quote.

**UI Components:**
- Quote header (similar to order detail)
- Line items table
- Totals
- Expiration countdown timer (if pending)
- Approval section:
  - "Approve Quote" button (primary) → Converts to order
  - "Reject Quote" button (secondary) → Requires rejection reason
  - Optional PO number input
  - Requested delivery date input
- Status history timeline

**GraphQL Mutations:**
```graphql
mutation CustomerApproveQuote(
  $quoteId: ID!
  $purchaseOrderNumber: String
  $requestedDeliveryDate: Date
) {
  customerApproveQuote(
    quoteId: $quoteId
    purchaseOrderNumber: $purchaseOrderNumber
    requestedDeliveryDate: $requestedDeliveryDate
  ) {
    id
    orderNumber
    status
  }
}

mutation CustomerRejectQuote($quoteId: ID!, $reason: String) {
  customerRejectQuote(quoteId: $quoteId, reason: $reason) {
    id
    status
  }
}
```

---

#### **RequestQuotePage** (`/portal/request-quote`)

**Purpose:** Submit new quote request.

**UI Components:**
- Product selection (dropdown or autocomplete)
- Quantity input (number, required, min: 1)
- Specifications (dynamic fields based on product type)
- Artwork uploader (drag-and-drop, accepts PDF, AI, EPS, JPG, PNG)
- Requested delivery date (date picker)
- Special instructions (textarea, optional)
- Customer PO number (optional)
- "Submit Quote Request" button (primary action)
- Preview section showing calculated estimate (if available)

**GraphQL Mutation:**
```graphql
mutation CustomerRequestQuote($input: CustomerQuoteRequestInput!) {
  customerRequestQuote(input: $input) {
    id
    quoteNumber
    status
  }
}
```

**Artwork Upload Flow:**
1. User selects file
2. Call `customerRequestArtworkUpload` to get presigned S3 URL
3. Upload file directly to S3 using presigned URL
4. Call `customerConfirmArtworkUpload` to trigger virus scanning
5. Show upload progress and virus scan status

---

#### **PendingProofsPage** (`/portal/proofs`)

**Purpose:** View and approve digital proofs.

**UI Components:**
- Page title: "Pending Proofs"
- Proofs list:
  - Order number
  - Product name
  - Proof thumbnail/preview
  - Version number
  - Upload date
  - Actions (View, Approve, Request Revision)
- Proof viewer modal:
  - Full-screen proof display
  - Zoom controls
  - Comments textarea
  - "Approve" button
  - "Request Revision" button with revision notes

**GraphQL Queries & Mutations:**
```graphql
query CustomerPendingProofs {
  customerPendingProofs {
    id
    orderId
    proofUrl
    version
    status
  }
}

mutation CustomerApproveProof($proofId: ID!, $comments: String) {
  customerApproveProof(proofId: $proofId, comments: $comments) {
    id
    status
    approvedAt
  }
}

mutation CustomerRequestProofRevision($proofId: ID!, $revisionNotes: String!) {
  customerRequestProofRevision(proofId: $proofId, revisionNotes: $revisionNotes) {
    id
    status
  }
}
```

---

#### **CustomerProfilePage** (`/portal/profile`)

**Purpose:** Manage customer user profile and preferences.

**UI Components:**
- Profile information section:
  - First name (editable)
  - Last name (editable)
  - Email (read-only, with "Change email" link)
  - Phone (editable)
  - Language preference (dropdown: English, Chinese)
  - Timezone (dropdown)
- Security section:
  - "Change password" button
  - MFA status (enabled/disabled)
  - "Enable MFA" / "Disable MFA" button
- Notification preferences:
  - Email notifications (toggle)
  - SMS notifications (toggle)
- "Save changes" button

**GraphQL Mutations:**
```graphql
mutation CustomerUpdateProfile($input: CustomerProfileUpdateInput!) {
  customerUpdateProfile(input: $input) {
    id
    firstName
    lastName
    phone
    preferredLanguage
    timezone
  }
}

mutation CustomerChangePassword($oldPassword: String!, $newPassword: String!) {
  customerChangePassword(oldPassword: $oldPassword, newPassword: $newPassword)
}
```

---

#### **CustomerSettingsPage** (`/portal/settings`)

**Purpose:** Advanced settings and preferences.

**UI Components:**
- MFA enrollment section (QR code display)
- Session management (active sessions list, revoke option)
- Data export (GDPR compliance)
- Account deletion request

---

## 5. Component Requirements

### 5.1 Layout Components

#### **CustomerPortalLayout**

**Purpose:** Wrapper layout for all customer portal pages (similar to `MainLayout` for internal ERP).

**Structure:**
```tsx
<div className="min-h-screen bg-gray-50">
  <CustomerHeader />
  <div className="flex">
    <CustomerSidebar />
    <main className="flex-1 p-6">
      <Outlet /> {/* React Router nested routes */}
    </main>
  </div>
</div>
```

**File Reference (Pattern):** `frontend/src/components/layout/MainLayout.tsx:1-18`

---

#### **CustomerHeader**

**Purpose:** Top navigation bar for customer portal.

**UI Components:**
- Logo (links to `/portal/dashboard`)
- Company name
- User menu dropdown:
  - User name display
  - "My Profile" link
  - "Settings" link
  - "Logout" button
- Language switcher (reuse existing `LanguageSwitcher` component)
- Notification bell icon (pending proofs count badge)

**File Reference (Pattern):** `frontend/src/components/layout/Header.tsx:1-50`

---

#### **CustomerSidebar**

**Purpose:** Left navigation menu for customer portal.

**Nav Items:**
- Dashboard (home icon)
- My Orders (package icon)
- My Quotes (file-text icon)
- Request Quote (plus-circle icon)
- Pending Proofs (check-circle icon)
- My Profile (user icon)

**Pattern:** Similar to internal `Sidebar.tsx` with NavLink components.

**File Reference (Pattern):** `frontend/src/components/layout/Sidebar.tsx:1-94`

---

### 5.2 Common Components

#### **OrderStatusBadge**

**Purpose:** Display order status with color coding.

**Props:**
```tsx
interface OrderStatusBadgeProps {
  status: SalesOrderStatus;
}
```

**Status Colors:**
- DRAFT → Gray
- CONFIRMED → Blue
- IN_PRODUCTION → Yellow
- SHIPPED → Indigo
- DELIVERED → Green
- INVOICED → Green
- CANCELLED → Red

**Usage:**
```tsx
<OrderStatusBadge status="IN_PRODUCTION" />
```

---

#### **QuoteCard**

**Purpose:** Display quote summary in grid/list view.

**Props:**
```tsx
interface QuoteCardProps {
  quote: CustomerQuote;
  onApprove?: (quoteId: string) => void;
  onReject?: (quoteId: string) => void;
}
```

---

#### **OrderCard**

**Purpose:** Display order summary in grid/list view.

**Props:**
```tsx
interface OrderCardProps {
  order: CustomerOrder;
  onClick?: () => void;
}
```

---

#### **ProofViewer**

**Purpose:** Display digital proof with zoom and approval controls.

**Props:**
```tsx
interface ProofViewerProps {
  proof: Proof;
  onApprove: (proofId: string, comments?: string) => void;
  onRequestRevision: (proofId: string, notes: string) => void;
}
```

**Features:**
- PDF/image display
- Zoom in/out controls
- Pan/drag
- Comments section
- Approval workflow

---

#### **ArtworkUploader**

**Purpose:** Drag-and-drop file uploader with virus scan status.

**Props:**
```tsx
interface ArtworkUploaderProps {
  onUploadComplete: (fileId: string, fileUrl: string) => void;
  quoteId?: string;
  orderId?: string;
  maxSizeMB?: number;
  allowedFileTypes?: string[];
}
```

**Features:**
- Drag-and-drop zone
- File validation (type, size)
- Upload progress bar
- Virus scan status display
- Multiple file support

**GraphQL Flow:**
1. Call `customerRequestArtworkUpload` → Get presigned S3 URL
2. Upload to S3 directly
3. Call `customerConfirmArtworkUpload` → Trigger virus scan
4. Poll or subscribe for scan status updates

---

#### **CustomerBreadcrumb**

**Purpose:** Navigation breadcrumb (reuse existing pattern).

**File Reference (Pattern):** `frontend/src/components/layout/Breadcrumb.tsx:1-50`

---

## 6. GraphQL Integration

### 6.1 Customer Portal Apollo Client

**Create:** `frontend/src/graphql/customerPortalClient.ts`

```typescript
import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Auth link - adds JWT token to headers
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('customerAccessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Error link - handles 401 errors and token refresh
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED') {
        // Token expired, attempt refresh
        const refreshToken = localStorage.getItem('customerRefreshToken');
        if (refreshToken) {
          // Call refresh token mutation
          // If successful, retry original operation
          // If failed, redirect to login
        }
      }
    }
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

export const customerPortalClient = new ApolloClient({
  link: from([authLink, errorLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
```

**File Reference (Pattern):** `frontend/src/graphql/client.ts:1-15`

---

### 6.2 GraphQL Mutations

**Create:** `frontend/src/graphql/mutations/customerAuth.ts`

```typescript
import { gql } from '@apollo/client';

export const CUSTOMER_LOGIN = gql`
  mutation CustomerLogin($email: String!, $password: String!, $mfaCode: String) {
    customerLogin(email: $email, password: $password, mfaCode: $mfaCode) {
      accessToken
      refreshToken
      expiresAt
      user {
        id
        customerId
        email
        firstName
        lastName
        role
        mfaEnabled
        isEmailVerified
        preferredLanguage
        timezone
      }
      customer {
        id
        customerName
        customerCode
      }
      permissions
    }
  }
`;

export const CUSTOMER_REGISTER = gql`
  mutation CustomerRegister(
    $customerCode: String!
    $email: String!
    $password: String!
    $firstName: String!
    $lastName: String!
  ) {
    customerRegister(
      customerCode: $customerCode
      email: $email
      password: $password
      firstName: $firstName
      lastName: $lastName
    ) {
      accessToken
      refreshToken
      expiresAt
      user {
        id
        email
        firstName
        lastName
      }
    }
  }
`;

export const CUSTOMER_LOGOUT = gql`
  mutation CustomerLogout {
    customerLogout
  }
`;

export const CUSTOMER_VERIFY_EMAIL = gql`
  mutation CustomerVerifyEmail($token: String!) {
    customerVerifyEmail(token: $token)
  }
`;

export const CUSTOMER_REQUEST_PASSWORD_RESET = gql`
  mutation CustomerRequestPasswordReset($email: String!) {
    customerRequestPasswordReset(email: $email)
  }
`;

export const CUSTOMER_RESET_PASSWORD = gql`
  mutation CustomerResetPassword($token: String!, $newPassword: String!) {
    customerResetPassword(token: $token, newPassword: $newPassword)
  }
`;

export const CUSTOMER_CHANGE_PASSWORD = gql`
  mutation CustomerChangePassword($oldPassword: String!, $newPassword: String!) {
    customerChangePassword(oldPassword: $oldPassword, newPassword: $newPassword)
  }
`;

export const CUSTOMER_UPDATE_PROFILE = gql`
  mutation CustomerUpdateProfile($input: CustomerProfileUpdateInput!) {
    customerUpdateProfile(input: $input) {
      id
      firstName
      lastName
      phone
      preferredLanguage
      timezone
    }
  }
`;

export const CUSTOMER_APPROVE_QUOTE = gql`
  mutation CustomerApproveQuote(
    $quoteId: ID!
    $purchaseOrderNumber: String
    $requestedDeliveryDate: Date
  ) {
    customerApproveQuote(
      quoteId: $quoteId
      purchaseOrderNumber: $purchaseOrderNumber
      requestedDeliveryDate: $requestedDeliveryDate
    ) {
      id
      orderNumber
      status
    }
  }
`;

export const CUSTOMER_REJECT_QUOTE = gql`
  mutation CustomerRejectQuote($quoteId: ID!, $reason: String) {
    customerRejectQuote(quoteId: $quoteId, reason: $reason) {
      id
      status
    }
  }
`;

export const CUSTOMER_REQUEST_QUOTE = gql`
  mutation CustomerRequestQuote($input: CustomerQuoteRequestInput!) {
    customerRequestQuote(input: $input) {
      id
      quoteNumber
      status
    }
  }
`;

export const CUSTOMER_APPROVE_PROOF = gql`
  mutation CustomerApproveProof($proofId: ID!, $comments: String) {
    customerApproveProof(proofId: $proofId, comments: $comments) {
      id
      status
      approvedAt
    }
  }
`;

export const CUSTOMER_REQUEST_PROOF_REVISION = gql`
  mutation CustomerRequestProofRevision($proofId: ID!, $revisionNotes: String!) {
    customerRequestProofRevision(proofId: $proofId, revisionNotes: $revisionNotes) {
      id
      status
    }
  }
`;
```

---

### 6.3 GraphQL Queries

**Create:** `frontend/src/graphql/queries/customerOrders.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_CUSTOMER_ME = gql`
  query CustomerMe {
    customerMe {
      id
      customerId
      email
      firstName
      lastName
      role
      mfaEnabled
      isEmailVerified
      preferredLanguage
      timezone
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
        trackingNumber
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
      }
    }
  }
`;
```

**Create:** `frontend/src/graphql/queries/customerQuotes.ts`

```typescript
import { gql } from '@apollo/client';

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
```

**Create:** `frontend/src/graphql/queries/customerProofs.ts`

```typescript
import { gql } from '@apollo/client';

export const GET_CUSTOMER_PENDING_PROOFS = gql`
  query CustomerPendingProofs {
    customerPendingProofs {
      id
      orderId
      proofUrl
      version
      status
    }
  }
`;

export const GET_CUSTOMER_ORDER_PROOFS = gql`
  query CustomerOrderProofs($orderNumber: String!) {
    customerOrderProofs(orderNumber: $orderNumber) {
      id
      proofUrl
      version
      status
      approvedAt
      revisionNotes
    }
  }
`;
```

---

## 7. Security & Authentication

### 7.1 Customer Authentication Context

**Create:** `frontend/src/contexts/CustomerAuthContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { CUSTOMER_LOGIN, CUSTOMER_LOGOUT } from '../graphql/mutations/customerAuth';
import { GET_CUSTOMER_ME } from '../graphql/queries/customerOrders';
import { CustomerUser, CustomerAuthPayload } from '../graphql/types/customerPortal';

interface CustomerAuthContextType {
  user: CustomerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const [loginMutation] = useMutation(CUSTOMER_LOGIN);
  const [logoutMutation] = useMutation(CUSTOMER_LOGOUT);
  const { data, refetch } = useQuery(GET_CUSTOMER_ME, { skip: !user });

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem('customerAccessToken');
    if (token) {
      refetch().then(({ data }) => {
        if (data?.customerMe) {
          setUser(data.customerMe);
        } else {
          localStorage.removeItem('customerAccessToken');
          localStorage.removeItem('customerRefreshToken');
        }
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [refetch]);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const { data } = await loginMutation({
      variables: { email, password, mfaCode },
    });

    if (data?.customerLogin) {
      const authPayload: CustomerAuthPayload = data.customerLogin;
      localStorage.setItem('customerAccessToken', authPayload.accessToken);
      localStorage.setItem('customerRefreshToken', authPayload.refreshToken);
      setUser(authPayload.user);
      navigate('/portal/dashboard');
    }
  };

  const logout = async () => {
    await logoutMutation();
    localStorage.removeItem('customerAccessToken');
    localStorage.removeItem('customerRefreshToken');
    setUser(null);
    navigate('/portal/login');
  };

  const refreshUser = async () => {
    const { data } = await refetch();
    if (data?.customerMe) {
      setUser(data.customerMe);
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return context;
};
```

---

### 7.2 Protected Route Component

**Create:** `frontend/src/components/customer-portal/CustomerProtectedRoute.tsx`

```typescript
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCustomerAuth } from '../../contexts/CustomerAuthContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const CustomerProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useCustomerAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  return <Outlet />;
};
```

---

### 7.3 Token Refresh Strategy

**Implement in Apollo Client error link:**

1. On 401 UNAUTHENTICATED error:
2. Read `customerRefreshToken` from localStorage
3. Call `customerRefreshToken` mutation
4. If success: Update `customerAccessToken`, retry original query
5. If failed: Clear tokens, redirect to `/portal/login`

**Auto-refresh before expiration:**
- Parse JWT `expiresAt` timestamp
- Set timeout to refresh 5 minutes before expiration
- Call `customerRefreshToken` mutation proactively

---

## 8. UX/UI Guidelines

### 8.1 Design Principles

**Consistency with Internal ERP:**
- Reuse existing Tailwind CSS utility classes
- Match color scheme (primary, secondary, gray palette)
- Use same component library patterns (`DataTable`, `LoadingSpinner`, etc.)

**Mobile-First Approach:**
- Responsive design for tablets and mobile devices
- Touch-friendly button sizes (min 44x44px)
- Simplified navigation for small screens

**Accessibility:**
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios ≥ 4.5:1
- Focus indicators
- ARIA labels

**Loading States:**
- Skeleton loaders for tables and cards
- Spinner for full-page loads
- Progress bars for file uploads
- Optimistic UI updates where appropriate

**Error Handling:**
- Toast notifications for success/error messages (use `react-hot-toast`)
- Inline validation errors
- Graceful degradation
- Retry mechanisms for failed operations

---

### 8.2 Status Color Coding

**Order Status:**
- DRAFT → `bg-gray-100 text-gray-800`
- CONFIRMED → `bg-blue-100 text-blue-800`
- IN_PRODUCTION → `bg-yellow-100 text-yellow-800`
- SHIPPED → `bg-indigo-100 text-indigo-800`
- DELIVERED → `bg-green-100 text-green-800`
- INVOICED → `bg-green-100 text-green-800`
- CANCELLED → `bg-red-100 text-red-800`

**Quote Status:**
- DRAFT → `bg-gray-100 text-gray-800`
- PENDING_APPROVAL → `bg-yellow-100 text-yellow-800`
- APPROVED → `bg-green-100 text-green-800`
- REJECTED → `bg-red-100 text-red-800`
- EXPIRED → `bg-gray-100 text-gray-600`
- CONVERTED → `bg-blue-100 text-blue-800`

**Proof Status:**
- PENDING_REVIEW → `bg-yellow-100 text-yellow-800`
- APPROVED → `bg-green-100 text-green-800`
- REVISION_REQUESTED → `bg-orange-100 text-orange-800`
- SUPERSEDED → `bg-gray-100 text-gray-600`

**File Reference (Pattern):** `frontend/src/pages/PurchaseOrdersPage.tsx:31-42`

---

### 8.3 Typography & Spacing

- Page titles: `text-2xl font-bold text-gray-900`
- Section headers: `text-lg font-semibold text-gray-800`
- Body text: `text-base text-gray-700`
- Labels: `text-sm font-medium text-gray-700`
- Helper text: `text-sm text-gray-500`
- Spacing: Use Tailwind spacing scale (p-4, p-6, gap-4, etc.)

---

## 9. Internationalization (i18n)

### 9.1 Translation Keys

**Add to:** `frontend/src/i18n/locales/en-US.json`

```json
{
  "customerPortal": {
    "nav": {
      "dashboard": "Dashboard",
      "orders": "My Orders",
      "quotes": "My Quotes",
      "requestQuote": "Request Quote",
      "pendingProofs": "Pending Proofs",
      "profile": "My Profile",
      "settings": "Settings",
      "logout": "Logout"
    },
    "auth": {
      "login": "Log In",
      "register": "Create Account",
      "logout": "Log Out",
      "email": "Email Address",
      "password": "Password",
      "confirmPassword": "Confirm Password",
      "firstName": "First Name",
      "lastName": "Last Name",
      "customerCode": "Customer Code",
      "mfaCode": "MFA Code",
      "rememberMe": "Remember me",
      "forgotPassword": "Forgot password?",
      "dontHaveAccount": "Don't have an account?",
      "alreadyHaveAccount": "Already have an account?",
      "verifyEmail": "Verify Email",
      "resetPassword": "Reset Password",
      "changePassword": "Change Password",
      "oldPassword": "Current Password",
      "newPassword": "New Password",
      "loginSuccess": "Login successful!",
      "logoutSuccess": "Logged out successfully",
      "registrationSuccess": "Registration successful! Please check your email to verify your account.",
      "passwordResetSent": "Password reset link sent! Check your email.",
      "passwordResetSuccess": "Password reset successfully! You can now log in.",
      "invalidCredentials": "Invalid email or password",
      "accountLocked": "Account locked due to too many failed login attempts. Please try again in 30 minutes.",
      "emailNotVerified": "Please verify your email address. Check your inbox for the verification link.",
      "invalidToken": "Invalid or expired verification link. Please request a new one.",
      "emailAlreadyRegistered": "This email is already registered. Please log in or use a different email.",
      "invalidCustomerCode": "Invalid customer code. Please check with your sales representative.",
      "passwordComplexity": "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      "passwordsDoNotMatch": "Passwords do not match."
    },
    "dashboard": {
      "title": "Welcome back, {{name}}!",
      "activeOrders": "Active Orders",
      "pendingQuotes": "Pending Quotes",
      "pendingProofs": "Pending Proofs",
      "recentOrders": "Recent Orders",
      "viewAllOrders": "View All Orders",
      "viewAllQuotes": "View All Quotes",
      "requestQuote": "Request a Quote"
    },
    "orders": {
      "title": "My Orders",
      "orderNumber": "Order Number",
      "orderDate": "Order Date",
      "status": "Status",
      "totalAmount": "Total Amount",
      "deliveryDate": "Delivery Date",
      "trackingNumber": "Tracking Number",
      "viewDetails": "View Details",
      "reorder": "Reorder",
      "trackShipment": "Track Shipment",
      "downloadInvoice": "Download Invoice",
      "noOrders": "You haven't placed any orders yet. Request a quote to get started!",
      "statusFilter": "Filter by Status",
      "dateRange": "Date Range"
    },
    "quotes": {
      "title": "My Quotes",
      "quoteNumber": "Quote Number",
      "quoteDate": "Quote Date",
      "expiresAt": "Expires",
      "status": "Status",
      "totalAmount": "Total Amount",
      "approve": "Approve Quote",
      "reject": "Reject Quote",
      "viewDetails": "View Details",
      "noQuotes": "You have no quotes. Request a quote to get started!",
      "approveConfirm": "Are you sure you want to approve this quote?",
      "rejectReason": "Reason for rejection (optional)",
      "approveSuccess": "Quote approved successfully! Your order has been created.",
      "rejectSuccess": "Quote rejected.",
      "expiringWarning": "This quote expires in {{days}} days!"
    },
    "requestQuote": {
      "title": "Request a Quote",
      "selectProduct": "Select Product",
      "quantity": "Quantity",
      "specifications": "Specifications",
      "uploadArtwork": "Upload Artwork",
      "deliveryDate": "Requested Delivery Date",
      "specialInstructions": "Special Instructions",
      "customerPoNumber": "Customer PO Number (Optional)",
      "submitRequest": "Submit Quote Request",
      "submitSuccess": "Quote request submitted successfully! We'll get back to you soon.",
      "uploadProgress": "Uploading...",
      "virusScanPending": "Virus scan in progress...",
      "virusScanClean": "File is safe",
      "virusScanInfected": "File contains a virus and was rejected"
    },
    "proofs": {
      "title": "Pending Proofs",
      "orderNumber": "Order Number",
      "version": "Version",
      "uploadDate": "Upload Date",
      "approve": "Approve Proof",
      "requestRevision": "Request Revision",
      "comments": "Comments (optional)",
      "revisionNotes": "Revision Notes",
      "approveSuccess": "Proof approved successfully!",
      "revisionSuccess": "Revision requested. We'll upload a new version soon.",
      "noProofs": "No proofs pending review."
    },
    "profile": {
      "title": "My Profile",
      "personalInfo": "Personal Information",
      "security": "Security",
      "notifications": "Notification Preferences",
      "saveChanges": "Save Changes",
      "updateSuccess": "Profile updated successfully!",
      "enableMFA": "Enable Multi-Factor Authentication",
      "disableMFA": "Disable Multi-Factor Authentication",
      "mfaEnabled": "MFA is enabled",
      "mfaDisabled": "MFA is disabled",
      "emailNotifications": "Email Notifications",
      "smsNotifications": "SMS Notifications"
    },
    "common": {
      "search": "Search",
      "filter": "Filter",
      "reset": "Reset",
      "apply": "Apply",
      "cancel": "Cancel",
      "save": "Save",
      "edit": "Edit",
      "delete": "Delete",
      "confirm": "Confirm",
      "back": "Back",
      "next": "Next",
      "previous": "Previous",
      "loading": "Loading...",
      "noData": "No data available",
      "error": "An error occurred",
      "success": "Success"
    }
  }
}
```

**Add corresponding Chinese translations to:** `frontend/src/i18n/locales/zh-CN.json`

**File Reference (Pattern):** `frontend/src/i18n/locales/en-US.json:1-100`

---

## 10. Testing Strategy

### 10.1 Manual Testing Checklist

**Authentication Flow:**
- [ ] Register new customer user
- [ ] Verify email via token link
- [ ] Log in with valid credentials
- [ ] Log in with invalid credentials (verify lockout after 5 attempts)
- [ ] Request password reset
- [ ] Reset password via token link
- [ ] Change password from profile
- [ ] Enable MFA and verify login with code
- [ ] Logout

**Order Management:**
- [ ] View order history
- [ ] Filter orders by status
- [ ] Search orders by order number
- [ ] View order details
- [ ] Reorder from past order
- [ ] Track shipment

**Quote Management:**
- [ ] Request new quote with artwork upload
- [ ] View quote history
- [ ] Approve quote (converts to order)
- [ ] Reject quote with reason
- [ ] View quote details

**Proof Approval:**
- [ ] View pending proofs
- [ ] Approve proof with comments
- [ ] Request revision with notes

**Profile Management:**
- [ ] Update profile information
- [ ] Change language preference (verify UI updates)
- [ ] Change timezone
- [ ] Update notification preferences

### 10.2 Error Scenarios

- [ ] Network error during login
- [ ] Expired JWT token (verify auto-refresh)
- [ ] Upload file exceeding size limit
- [ ] Upload infected file (verify virus scan rejection)
- [ ] Submit quote request with missing required fields
- [ ] Approve expired quote
- [ ] Access protected route without authentication

### 10.3 Responsive Design Testing

- [ ] Test on mobile (375px, 768px)
- [ ] Test on tablet (768px, 1024px)
- [ ] Test on desktop (1280px, 1920px)
- [ ] Verify navigation menu on mobile
- [ ] Verify tables are scrollable on small screens

---

## 11. Implementation Roadmap

### Phase 1: Authentication & Layout (Week 1)

**Priority:** High
**Estimated Effort:** 2-3 days

**Tasks:**
1. Create `CustomerAuthContext` and authentication state management
2. Implement `customerPortalClient` with JWT token handling
3. Build authentication pages:
   - CustomerLoginPage
   - CustomerRegisterPage
   - VerifyEmailPage
   - ForgotPasswordPage
   - ResetPasswordPage
4. Create `CustomerProtectedRoute` component
5. Create `CustomerPortalLayout`, `CustomerHeader`, `CustomerSidebar`
6. Add customer portal routes to `App.tsx`
7. Add i18n translation keys

**Deliverables:**
- Fully functional authentication flow
- Protected route system
- Portal layout and navigation

---

### Phase 2: Dashboard & Order Management (Week 2)

**Priority:** High
**Estimated Effort:** 3-4 days

**Tasks:**
1. Build `CustomerDashboard` with summary cards
2. Build `CustomerOrdersPage` with filtering and search
3. Build `CustomerOrderDetailPage` with line items and tracking
4. Create `OrderStatusBadge` component
5. Create `OrderCard` component
6. Implement GraphQL queries for orders
7. Add "Reorder" functionality

**Deliverables:**
- Customer dashboard
- Order history and detail pages
- Order tracking

---

### Phase 3: Quote Management (Week 3)

**Priority:** High
**Estimated Effort:** 3-4 days

**Tasks:**
1. Build `CustomerQuotesPage` with filtering
2. Build `CustomerQuoteDetailPage` with approval workflow
3. Build `RequestQuotePage` with product selection
4. Create `QuoteCard` component
5. Create `ArtworkUploader` component with S3 integration
6. Implement GraphQL queries and mutations for quotes
7. Add quote approval/rejection flow

**Deliverables:**
- Quote history and detail pages
- Quote request form
- Artwork upload with virus scanning

---

### Phase 4: Proof Approval & Profile (Week 4)

**Priority:** Medium
**Estimated Effort:** 2-3 days

**Tasks:**
1. Build `PendingProofsPage`
2. Create `ProofViewer` component with zoom and comments
3. Implement proof approval/revision workflow
4. Build `CustomerProfilePage` with MFA enrollment
5. Build `CustomerSettingsPage`
6. Add GraphQL mutations for proofs and profile

**Deliverables:**
- Proof approval interface
- Profile management
- MFA enrollment

---

### Phase 5: Testing & Refinement (Week 5)

**Priority:** High
**Estimated Effort:** 2-3 days

**Tasks:**
1. Manual testing of all flows
2. Responsive design testing
3. Accessibility audit
4. Performance optimization (lazy loading, code splitting)
5. Error handling improvements
6. Documentation updates

**Deliverables:**
- Tested and refined customer portal
- Documentation for deployment

---

## 12. References

### 12.1 Backend Files

**Database Schema:**
- `backend/migrations/V0.0.43__create_customer_portal_tables.sql` - Customer portal tables

**GraphQL Schema:**
- `backend/src/graphql/schema/customer-portal.graphql` - Customer portal API

**Services:**
- `backend/src/modules/customer-auth/customer-auth.service.ts` - Authentication service
- `backend/src/modules/customer-portal/customer-portal.resolver.ts` - GraphQL resolver

**Modules:**
- `backend/src/modules/customer-auth/customer-auth.module.ts` - Auth module
- `backend/src/modules/customer-portal/customer-portal.module.ts` - Portal module

### 12.2 Frontend Files (Existing Patterns)

**Routing:**
- `frontend/src/App.tsx:1-113` - Routing structure

**Layout:**
- `frontend/src/components/layout/MainLayout.tsx:1-18` - Layout pattern
- `frontend/src/components/layout/Sidebar.tsx:1-94` - Sidebar navigation
- `frontend/src/components/layout/Header.tsx:1-50` - Header pattern

**Pages:**
- `frontend/src/pages/PurchaseOrdersPage.tsx:44-200` - List page pattern
- `frontend/src/pages/PurchaseOrderDetailPageEnhanced.tsx:1-200` - Detail page pattern
- `frontend/src/pages/ExecutiveDashboard.tsx:1-100` - Dashboard pattern

**Apollo Client:**
- `frontend/src/graphql/client.ts:1-15` - Apollo setup

**Components:**
- `frontend/src/components/common/DataTable.tsx` - Reusable table
- `frontend/src/components/common/LoadingSpinner.tsx` - Loading states
- `frontend/src/components/layout/Breadcrumb.tsx:1-50` - Breadcrumb pattern

**i18n:**
- `frontend/src/i18n/locales/en-US.json:1-100` - Translation structure

### 12.3 Previous Deliverables

**Research:**
- `backend/CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328659.md` - Customer Portal & Self-Service Ordering Research (comprehensive industry analysis)

**Related Implementation (Phase 1A - Backend Complete):**
- Customer authentication backend: Fully implemented
- Database schema: Fully implemented
- GraphQL API: Fully implemented

---

## Conclusion

This research deliverable provides Marcus with a complete technical specification for implementing the Customer Portal Frontend. The backend is fully operational, providing a robust GraphQL API with authentication, order management, quote automation, and proof approval workflows.

**Key Success Factors:**
1. **Reuse Existing Patterns:** Follow the established React + TypeScript + Apollo Client architecture
2. **Consistent UX:** Match the internal ERP's design language and component library
3. **Security First:** Implement robust JWT token handling with auto-refresh
4. **Mobile-First:** Ensure responsive design for all screen sizes
5. **Accessibility:** WCAG 2.1 AA compliance
6. **Internationalization:** Full i18n support for English and Chinese
7. **Progressive Enhancement:** Implement in phases (auth → orders → quotes → proofs)

The implementation roadmap provides a clear path from authentication to full self-service functionality, with realistic time estimates and prioritization.

**Next Steps:**
1. Marcus reviews this research deliverable
2. Begin Phase 1: Authentication & Layout
3. Iterate through phases with regular testing
4. Deploy to staging for user acceptance testing

---

**Research Status:** ✅ COMPLETE

**Deliverable Published to:** `nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767066329943`

**Prepared by:** Cynthia (Research Analyst)
**Date:** 2025-12-29
