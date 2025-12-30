# Research Deliverable: Frontend Authentication Implementation
**REQ-STRATEGIC-AUTO-1767066329939**

**Research Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-29
**Status:** COMPLETE

---

## Executive Summary

This research deliverable provides a comprehensive analysis of implementing frontend authentication for the AgogSaaS Print Industry ERP application. The backend authentication infrastructure is **already implemented** for customer portal users via REQ-STRATEGIC-AUTO-1767048328659. This research focuses on integrating frontend authentication flows to leverage the existing backend JWT-based authentication system.

**Key Finding:** The backend has a complete JWT authentication system for customer portal users, but the frontend currently has **no authentication layer** - all routes are publicly accessible without login requirements.

---

## 1. Current State Analysis

### 1.1 Backend Authentication Infrastructure (EXISTING)

The backend has a complete authentication system implemented:

**Location:** `print-industry-erp/backend/src/modules/customer-auth/`

**Components:**
- **CustomerAuthModule** (`customer-auth.module.ts`)
  - JWT-based authentication using `@nestjs/jwt` and `@nestjs/passport`
  - Access tokens: 30 minutes lifespan
  - Refresh tokens: 14 days lifespan
  - Secret: `CUSTOMER_JWT_SECRET` environment variable

- **CustomerAuthService** (`customer-auth.service.ts`)
  - `register()` - Customer user registration with email verification
  - `login()` - Email/password authentication with optional MFA
  - `refreshToken()` - Token refresh mechanism
  - `logout()` - Token revocation
  - Password complexity validation (8+ chars, uppercase, lowercase, number)
  - Account lockout after 5 failed login attempts (30-minute lockout)
  - Email verification required before access
  - MFA support (TOTP) - placeholder for future implementation

- **CustomerJwtStrategy** (`strategies/customer-jwt.strategy.ts`)
  - Passport strategy for JWT validation
  - Extracts JWT from Authorization Bearer header
  - Validates token payload and user status
  - Checks email verification and active status

- **CustomerAuthGuard** (`guards/customer-auth.guard.ts`)
  - GraphQL-compatible auth guard
  - Protects routes requiring authentication

**Database Tables (V0.0.43 migration):**
- `customer_users` - Customer portal user accounts
- `refresh_tokens` - JWT refresh token storage (hashed)
- `customer_activity_log` - Audit log for security and compliance
- `artwork_files`, `proofs` - Customer portal features

**GraphQL API Endpoints:**
```graphql
# Authentication Mutations
customerRegister(customerCode, email, password, firstName, lastName): CustomerAuthPayload
customerLogin(email, password, mfaCode?): CustomerAuthPayload
customerRefreshToken(refreshToken): CustomerAuthPayload
customerLogout: Boolean

# Password Management
customerRequestPasswordReset(email): Boolean
customerResetPassword(token, newPassword): Boolean
customerChangePassword(oldPassword, newPassword): Boolean

# Email Verification
customerVerifyEmail(token): Boolean
customerResendVerificationEmail: Boolean

# MFA (placeholder)
customerEnrollMFA: MFAEnrollmentPayload
customerVerifyMFA(code): Boolean
customerDisableMFA(password): Boolean

# Protected Queries
customerMe: CustomerUser  # Requires authentication
customerOrders: CustomerOrdersResult  # Requires authentication
customerQuotes: CustomerQuotesResult  # Requires authentication
```

**Security Features:**
- bcrypt password hashing (10 salt rounds)
- Account lockout after 5 failed attempts (30 minutes)
- Email verification required
- Token rotation (access + refresh tokens)
- Refresh tokens stored hashed in database
- Row Level Security (RLS) for multi-tenant isolation
- GDPR compliance (soft delete, data retention consent)

### 1.2 Frontend Current State (NO AUTHENTICATION)

**Location:** `print-industry-erp/frontend/`

**Current Architecture:**
- **Framework:** React 18 + TypeScript + Vite
- **Routing:** React Router v6 (`react-router-dom`)
- **State Management:** Zustand (`zustand`) with persistence
- **GraphQL Client:** Apollo Client (`@apollo/client`)
- **UI Framework:** Material-UI v5 + TailwindCSS
- **HTTP:** All routes currently public, no authentication

**App Structure:**
```typescript
// App.tsx (print-industry-erp/frontend/src/App.tsx)
<Router>
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" />} />
    <Route element={<MainLayout />}>
      <Route path="/dashboard" element={<ExecutiveDashboard />} />
      <Route path="/operations" element={<OperationsDashboard />} />
      <Route path="/wms" element={<WMSDashboard />} />
      // ... 40+ routes, all publicly accessible
    </Route>
  </Routes>
</Router>
```

**State Store:**
```typescript
// appStore.ts (print-industry-erp/frontend/src/store/appStore.ts)
interface UserPreferences {
  language: 'en' | 'zh';
  selectedFacility: string | null;
  theme: 'light' | 'dark';
  tenantId?: string;  // Multi-tenant support exists
}
// No user authentication state
```

**GraphQL Client:**
```typescript
// client.ts (print-industry-erp/frontend/src/graphql/client.ts)
const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

export const apolloClient = new ApolloClient({
  link: httpLink,  // No authentication headers
  cache: new InMemoryCache(),
});
```

**Critical Gap:** The Apollo Client does not include authentication headers. All GraphQL requests are unauthenticated.

### 1.3 Existing Dependencies (READY TO USE)

**Frontend package.json:**
```json
{
  "dependencies": {
    "react-router-dom": "^6.20.1",  // Route protection
    "zustand": "^5.0.9",  // State management with persist
    "@apollo/client": "^3.8.8",  // GraphQL client (needs auth link)
    "react-hot-toast": "^2.4.1",  // Toast notifications
    "react": "^18.2.0"
  }
}
```

**Backend package.json:**
```json
{
  "dependencies": {
    "@nestjs/jwt": "^10.2.0",  // JWT signing/verification
    "@nestjs/passport": "^10.0.3",  // Auth strategies
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "bcrypt": "^5.1.1"  // Password hashing
  }
}
```

**No additional npm packages required for frontend authentication.**

---

## 2. Implementation Requirements

### 2.1 Frontend Components Needed

**2.1.1 Authentication Pages**
- **LoginPage** (`src/pages/auth/LoginPage.tsx`)
  - Email/password form
  - "Remember me" checkbox (persist refresh token)
  - "Forgot password" link
  - Error handling for locked accounts, unverified email
  - MFA code input (conditional)

- **RegisterPage** (`src/pages/auth/RegisterPage.tsx`)
  - Customer code input (for validation)
  - Email, password, first name, last name
  - Password strength indicator
  - Terms of service acceptance
  - Email verification message after registration

- **ForgotPasswordPage** (`src/pages/auth/ForgotPasswordPage.tsx`)
  - Email input
  - "Check your email" confirmation message

- **ResetPasswordPage** (`src/pages/auth/ResetPasswordPage.tsx`)
  - New password input with confirmation
  - Password strength indicator
  - Token validation (from URL param)

- **EmailVerificationPage** (`src/pages/auth/EmailVerificationPage.tsx`)
  - Auto-verify on mount using token from URL
  - Success/error message
  - "Resend verification email" button

**2.1.2 Authentication Store (Zustand)**

Location: `src/store/authStore.ts`

```typescript
interface AuthUser {
  id: string;
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER_ADMIN' | 'CUSTOMER_USER' | 'APPROVER';
  mfaEnabled: boolean;
  isEmailVerified: boolean;
}

interface Customer {
  id: string;
  customer_name: string;
  customer_code: string;
}

interface AuthState {
  // Authentication state
  isAuthenticated: boolean;
  user: AuthUser | null;
  customer: Customer | null;
  permissions: string[];

  // Tokens
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;

  // Actions
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  setAuthData: (authPayload: CustomerAuthPayload) => void;
  clearAuth: () => void;

  // Token refresh
  isRefreshing: boolean;
  refreshPromise: Promise<boolean> | null;
}
```

**Persistence Strategy:**
- Persist `refreshToken` to localStorage (Zustand persist middleware)
- Do NOT persist `accessToken` (security - short-lived, in-memory only)
- On app initialization, check if refreshToken exists and attempt refresh

**2.1.3 GraphQL Client Configuration**

Location: `src/graphql/client.ts`

**Required Changes:**
1. Add `setContext` link from `@apollo/client/link/context`
2. Inject Authorization header with access token
3. Add error link for handling 401 Unauthorized
4. Implement token refresh on 401 errors

```typescript
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Auth link - inject Bearer token
const authLink = setContext((_, { headers }) => {
  const token = useAuthStore.getState().accessToken;
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Error link - handle 401 and token refresh
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  if (graphQLErrors) {
    for (let err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED') {
        // Attempt token refresh
        return fromPromise(
          useAuthStore.getState().refreshAccessToken()
        ).flatMap(() => forward(operation));
      }
    }
  }
});

// Chain: authLink -> errorLink -> httpLink
```

**2.1.4 Route Protection**

Location: `src/components/auth/ProtectedRoute.tsx`

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login, preserve intended destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && !user.isEmailVerified) {
    // Redirect to email verification reminder
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
};
```

**App.tsx Route Structure:**
```typescript
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
  <Route path="/verify-email/:token" element={<EmailVerificationPage />} />

  {/* Protected routes */}
  <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
    <Route path="/" element={<Navigate to="/dashboard" />} />
    <Route path="/dashboard" element={<ExecutiveDashboard />} />
    {/* All existing routes wrapped in ProtectedRoute */}
  </Route>
</Routes>
```

**2.1.5 Token Refresh Strategy**

**Approach:** Proactive token refresh before expiration

```typescript
// Auto-refresh 5 minutes before expiration
useEffect(() => {
  const interval = setInterval(() => {
    const { tokenExpiresAt, refreshAccessToken } = useAuthStore.getState();

    if (tokenExpiresAt) {
      const timeUntilExpiry = tokenExpiresAt.getTime() - Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (timeUntilExpiry <= fiveMinutes) {
        refreshAccessToken();
      }
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, []);
```

**Token Refresh Mutex:** Prevent multiple simultaneous refresh requests using a promise.

### 2.2 GraphQL Mutations and Queries

**Authentication GraphQL Operations:**

Location: `src/graphql/mutations/auth.ts`

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
      }
      customer {
        id
        customer_name
        customer_code
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
      user { /* ... */ }
      customer { /* ... */ }
      permissions
    }
  }
`;

export const CUSTOMER_REFRESH_TOKEN = gql`
  mutation CustomerRefreshToken($refreshToken: String!) {
    customerRefreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      expiresAt
      user { /* ... */ }
      customer { /* ... */ }
      permissions
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
```

Location: `src/graphql/queries/auth.ts`

```typescript
export const CUSTOMER_ME = gql`
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
      lastLoginAt
      customer {
        id
        customer_name
        customer_code
      }
    }
  }
`;
```

### 2.3 UI/UX Considerations

**2.3.1 Loading States**
- Show loading spinner during login/register/refresh
- Skeleton loaders for protected routes while checking auth state
- "Logging out..." message on logout

**2.3.2 Error Handling**
- Network errors: "Unable to connect. Please try again."
- Invalid credentials: "Invalid email or password"
- Account locked: "Too many failed attempts. Account locked for 30 minutes."
- Email not verified: "Please verify your email address. Check your inbox."
- MFA required: Show MFA code input field
- Token expired: Automatically refresh or redirect to login

**2.3.3 User Feedback**
- Success toast: "Login successful"
- Error toast: "Login failed: [reason]"
- Email verification reminder banner (if not verified)
- Password strength indicator on registration

**2.3.4 Accessibility**
- Keyboard navigation for forms
- Screen reader support for error messages
- Focus management (auto-focus email field on login page)

**2.3.5 Internationalization**
- Support existing i18n (English, Chinese)
- Translate authentication UI strings
- Error messages in user's preferred language

### 2.4 Security Considerations

**2.4.1 Token Storage**
- **Access Token:** In-memory only (Zustand state, not persisted)
- **Refresh Token:** localStorage (encrypted if possible, but acceptable for non-critical apps)
- **Alternative:** Consider using httpOnly cookies for refresh tokens (requires backend changes)

**2.4.2 XSS Protection**
- React's built-in XSS protection via JSX escaping
- Validate all user inputs
- Sanitize error messages before display

**2.4.3 CSRF Protection**
- Not required for Bearer token authentication (no cookies)
- Backend already uses JWT tokens (stateless)

**2.4.4 Session Management**
- Logout on token expiration (if refresh fails)
- "You've been logged out due to inactivity" message
- Clear all auth state on logout

**2.4.5 Password Security**
- Client-side password strength validation (mirrors backend)
- Never log passwords to console
- Clear password field on submission failure

---

## 3. Implementation Strategy

### 3.1 Phase 1: Foundation (Authentication Store + GraphQL Client)

**Tasks:**
1. Create `authStore.ts` with Zustand
   - Define auth state interface
   - Implement login, register, logout, refresh actions
   - Add persistence for refresh token only

2. Update Apollo Client configuration
   - Add auth link for Bearer token injection
   - Add error link for 401 handling
   - Implement token refresh logic

3. Create GraphQL operations
   - Mutations: login, register, logout, refresh, verify email, reset password
   - Queries: customerMe

**Estimated Complexity:** Medium

### 3.2 Phase 2: Authentication Pages

**Tasks:**
1. Create LoginPage
   - Email/password form
   - MFA code input (conditional)
   - Error handling
   - "Forgot password" link

2. Create RegisterPage
   - Customer code, email, password, name fields
   - Password strength indicator
   - Terms of service

3. Create ForgotPasswordPage and ResetPasswordPage
   - Password reset flow
   - Token validation

4. Create EmailVerificationPage
   - Auto-verify on mount
   - Resend verification email

**Estimated Complexity:** Medium

### 3.3 Phase 3: Route Protection

**Tasks:**
1. Create ProtectedRoute component
   - Check authentication status
   - Redirect to login if unauthenticated
   - Preserve intended destination

2. Update App.tsx
   - Wrap MainLayout and all dashboard routes in ProtectedRoute
   - Add public routes for authentication pages

3. Add token refresh on app initialization
   - Check localStorage for refresh token
   - Attempt token refresh on app load
   - Show loading screen during auth check

**Estimated Complexity:** Low

### 3.4 Phase 4: UI Polish & Testing

**Tasks:**
1. Add loading states and error handling
2. Implement toast notifications
3. Add email verification reminder banner
4. Test all authentication flows:
   - Login (success, failure, MFA)
   - Registration (success, duplicate email, invalid customer code)
   - Logout
   - Token refresh (manual and automatic)
   - Email verification
   - Password reset
   - Account lockout (5 failed attempts)

**Estimated Complexity:** Low

---

## 4. Architecture Decisions

### 4.1 State Management: Zustand (RECOMMENDED)

**Pros:**
- Already used in the app (`appStore.ts`)
- Simple API, less boilerplate than Redux
- Built-in persistence middleware
- TypeScript-friendly

**Cons:**
- Less ecosystem support than Redux

**Alternative:** React Context + useReducer (more boilerplate, no persistence)

**Decision:** Use Zustand for consistency with existing codebase.

### 4.2 Token Storage: localStorage (ACCEPTABLE)

**Pros:**
- Simple implementation
- Works across tabs
- Survives page refreshes

**Cons:**
- Vulnerable to XSS attacks
- Not as secure as httpOnly cookies

**Alternative:** httpOnly cookies (requires backend changes to set cookies)

**Decision:** Use localStorage for refresh token, in-memory for access token. Accept XSS risk as acceptable for B2B ERP application with limited external attack surface.

### 4.3 Token Refresh Strategy: Proactive (RECOMMENDED)

**Options:**
1. **Reactive:** Refresh on 401 error
2. **Proactive:** Refresh before expiration (5 min buffer)

**Decision:** Use proactive refresh to prevent user-facing errors. Fallback to reactive refresh on 401.

### 4.4 Route Protection: Wrapper Component (RECOMMENDED)

**Options:**
1. Wrapper component (`<ProtectedRoute>`)
2. Higher-order component (HOC)
3. Custom route config

**Decision:** Use wrapper component for clarity and React Router v6 compatibility.

---

## 5. Testing Requirements

### 5.1 Unit Tests

**Authentication Store:**
- Login action sets auth state correctly
- Logout action clears auth state
- Token refresh updates access token
- Refresh token mutex prevents concurrent refreshes

**Route Protection:**
- Redirects to /login if unauthenticated
- Allows access if authenticated
- Redirects to /verify-email if email not verified

### 5.2 Integration Tests

**Login Flow:**
1. User enters valid credentials
2. Backend returns auth payload
3. Store updates with user data
4. User redirected to dashboard
5. GraphQL requests include Bearer token

**Token Refresh Flow:**
1. Access token expires
2. Refresh token used to get new access token
3. GraphQL request retried with new token

**Logout Flow:**
1. User clicks logout
2. Refresh token revoked on backend
3. Store cleared
4. User redirected to login page

### 5.3 E2E Tests (Optional)

- Full registration → email verification → login flow
- Login → browse app → logout flow
- Password reset flow
- Account lockout after 5 failed attempts

---

## 6. Implementation Checklist

### Frontend Developer (Marcus) Tasks:

**Phase 1: Foundation**
- [ ] Create `src/store/authStore.ts` with Zustand
  - [ ] Define `AuthState` interface
  - [ ] Implement `login()`, `register()`, `logout()`, `refreshAccessToken()` actions
  - [ ] Configure Zustand persist middleware for refresh token
- [ ] Update `src/graphql/client.ts`
  - [ ] Add `authLink` for Bearer token injection
  - [ ] Add `errorLink` for 401 handling and token refresh
  - [ ] Chain links: authLink -> errorLink -> httpLink
- [ ] Create `src/graphql/mutations/auth.ts`
  - [ ] CUSTOMER_LOGIN, CUSTOMER_REGISTER, CUSTOMER_LOGOUT, CUSTOMER_REFRESH_TOKEN
  - [ ] CUSTOMER_VERIFY_EMAIL, CUSTOMER_REQUEST_PASSWORD_RESET, CUSTOMER_RESET_PASSWORD
- [ ] Create `src/graphql/queries/auth.ts`
  - [ ] CUSTOMER_ME query

**Phase 2: Authentication Pages**
- [ ] Create `src/pages/auth/LoginPage.tsx`
  - [ ] Email/password form with validation
  - [ ] MFA code input (conditional)
  - [ ] "Forgot password" link
  - [ ] Error handling (invalid credentials, locked account, unverified email)
- [ ] Create `src/pages/auth/RegisterPage.tsx`
  - [ ] Customer code, email, password, name fields
  - [ ] Password strength indicator
  - [ ] Terms of service checkbox
- [ ] Create `src/pages/auth/ForgotPasswordPage.tsx`
  - [ ] Email input
  - [ ] "Check your email" confirmation
- [ ] Create `src/pages/auth/ResetPasswordPage.tsx`
  - [ ] New password input with confirmation
  - [ ] Token validation from URL
- [ ] Create `src/pages/auth/EmailVerificationPage.tsx`
  - [ ] Auto-verify on mount using token from URL
  - [ ] Success/error message
  - [ ] "Resend verification email" button

**Phase 3: Route Protection**
- [ ] Create `src/components/auth/ProtectedRoute.tsx`
  - [ ] Check `isAuthenticated` from authStore
  - [ ] Redirect to /login if not authenticated
  - [ ] Preserve intended destination in location state
  - [ ] Check email verification status
- [ ] Update `src/App.tsx`
  - [ ] Add public routes: /login, /register, /forgot-password, /reset-password/:token, /verify-email/:token
  - [ ] Wrap `<MainLayout>` in `<ProtectedRoute>`
  - [ ] Add route for redirect after login (use location state)
- [ ] Add token refresh on app initialization
  - [ ] Check localStorage for refresh token on mount
  - [ ] Attempt `refreshAccessToken()` if token exists
  - [ ] Show loading screen during auth check

**Phase 4: UI Polish**
- [ ] Add loading states (login, register, logout)
- [ ] Add toast notifications (react-hot-toast)
  - [ ] Success: "Login successful", "Registration successful"
  - [ ] Error: "Invalid credentials", "Account locked", etc.
- [ ] Add email verification reminder banner (if not verified)
- [ ] Add password strength indicator (RegisterPage, ResetPasswordPage)
- [ ] Add i18n support for authentication UI
  - [ ] Update `src/i18n/locales/en-US.json`
  - [ ] Update `src/i18n/locales/zh-CN.json`
- [ ] Add keyboard navigation and accessibility
- [ ] Add "Remember me" checkbox on LoginPage (optional, refresh token already persists)

**Phase 5: Testing**
- [ ] Test login flow (success, invalid credentials, MFA, locked account)
- [ ] Test registration flow (success, duplicate email, invalid customer code)
- [ ] Test logout flow
- [ ] Test token refresh (manual and automatic)
- [ ] Test email verification flow
- [ ] Test password reset flow
- [ ] Test route protection (redirect to login, redirect to verify email)
- [ ] Test error handling (network errors, 401, 403)

---

## 7. Environment Configuration

### 7.1 Frontend Environment Variables

**File:** `print-industry-erp/frontend/.env`

```bash
# GraphQL API URL
VITE_GRAPHQL_URL=http://localhost:4000/graphql

# Optional: Token expiration buffer (minutes before expiration to refresh)
VITE_TOKEN_REFRESH_BUFFER=5
```

**Already configured in `.env.example`**

### 7.2 Backend Environment Variables

**File:** `print-industry-erp/backend/.env`

```bash
# Customer JWT secret (required)
CUSTOMER_JWT_SECRET=your-secret-key-change-me-in-production

# Optional: Email service configuration (for verification emails)
EMAIL_SERVICE_PROVIDER=sendgrid  # or ses, mailgun, smtp
EMAIL_FROM_ADDRESS=noreply@agogsaas.com
SENDGRID_API_KEY=your-sendgrid-api-key
```

**Note:** Email service configuration is NOT required for MVP. Email verification can be implemented later.

---

## 8. Dependencies

### 8.1 Existing Dependencies (No Installation Needed)

**Frontend:**
- `react-router-dom` - Route protection
- `zustand` - State management
- `@apollo/client` - GraphQL client (auth link)
- `react-hot-toast` - Toast notifications
- `react` - UI components

**Backend:**
- `@nestjs/jwt` - JWT signing/verification
- `@nestjs/passport` - Auth strategies
- `passport-jwt` - JWT strategy
- `bcrypt` - Password hashing

**No additional npm packages required.**

### 8.2 Optional Dependencies (Future Enhancement)

**Frontend:**
- `speakeasy` - TOTP MFA library (if implementing MFA)
- `qrcode.react` - QR code generation for MFA enrollment

**Backend:**
- Email service SDK (SendGrid, AWS SES, Mailgun) - if implementing email verification

---

## 9. Migration Path from Public to Authenticated

### 9.1 Current State: All Routes Public

**Issue:** All dashboard routes are currently accessible without login. This is acceptable for development but not for production.

### 9.2 Migration Strategy

**Option 1: Big Bang (RECOMMENDED for this app)**
- Implement authentication and protect all routes at once
- Simple, no partial states
- Low risk (B2B app, not public-facing)

**Option 2: Gradual Migration**
- Phase 1: Add authentication pages (login, register)
- Phase 2: Protect sensitive routes (approvals, purchase orders)
- Phase 3: Protect all routes
- More complex, risk of inconsistent security

**Recommendation:** Use Option 1 (Big Bang) for simplicity.

### 9.3 Backwards Compatibility

**Internal Users vs. Customer Portal Users:**
- Backend has two separate authentication realms:
  1. `users` table - Internal employees (NOT IMPLEMENTED IN FRONTEND)
  2. `customer_users` table - Customer portal users (IMPLEMENTED IN BACKEND)

**Current Scope:** This implementation focuses on **customer portal users only**.

**Future Work:** If internal employees need frontend access, create separate:
- `InternalAuthService` (backend)
- Internal login page (frontend)
- Role-based route protection (customer vs. internal)

---

## 10. Risks and Mitigation

### 10.1 Risk: Token Theft via XSS

**Mitigation:**
- Use React's built-in XSS protection
- Sanitize all user inputs
- Store access token in memory only (not localStorage)
- Implement Content Security Policy (CSP) headers

### 10.2 Risk: Token Expiration During User Session

**Mitigation:**
- Implement proactive token refresh (5 min before expiration)
- Show user-friendly message on refresh failure
- Allow user to re-login without losing context

### 10.3 Risk: Multiple Tab Synchronization

**Issue:** User logs out in one tab, other tabs still show authenticated state.

**Mitigation:**
- Use `localStorage` events to sync auth state across tabs
- Listen for `storage` event in authStore
- Automatically logout all tabs when one tab logs out

### 10.4 Risk: Backend API Changes

**Mitigation:**
- Backend authentication API is stable (already implemented)
- GraphQL schema is versioned
- Low risk of breaking changes

---

## 11. Performance Considerations

### 11.1 Initial Load Time

**Issue:** Token refresh on app initialization adds latency.

**Mitigation:**
- Show loading screen during auth check
- Use skeleton loaders for dashboard
- Cache user data in Zustand persist

### 11.2 GraphQL Request Overhead

**Issue:** Every GraphQL request includes Bearer token (adds ~200 bytes).

**Mitigation:**
- Negligible overhead for B2B ERP app
- Accept as industry standard for JWT authentication

### 11.3 Token Refresh Frequency

**Issue:** Proactive refresh every 25 minutes (30 min token - 5 min buffer).

**Mitigation:**
- Use refresh token mutex to prevent concurrent refreshes
- Only refresh if user is active (check last activity timestamp)

---

## 12. Accessibility Considerations

### 12.1 WCAG 2.1 Compliance

**Requirements:**
- Keyboard navigation for all forms
- Screen reader support for error messages
- Focus management (auto-focus email field on login)
- Sufficient color contrast for error messages
- ARIA labels for form fields

### 12.2 Implementation

**LoginPage:**
```tsx
<form onSubmit={handleLogin}>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-required="true"
    aria-invalid={!!errors.email}
    aria-describedby="email-error"
    autoFocus
  />
  {errors.email && (
    <span id="email-error" role="alert">
      {errors.email}
    </span>
  )}
</form>
```

---

## 13. Internationalization (i18n)

### 13.1 Authentication UI Strings

**English (`en-US.json`):**
```json
{
  "auth": {
    "login": "Login",
    "register": "Register",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot Password?",
    "loginSuccess": "Login successful",
    "loginFailed": "Invalid email or password",
    "accountLocked": "Too many failed attempts. Account locked for 30 minutes.",
    "emailNotVerified": "Please verify your email address. Check your inbox.",
    "mfaRequired": "Enter your MFA code",
    "registerSuccess": "Registration successful. Please check your email to verify your account.",
    "passwordResetSent": "Password reset email sent. Check your inbox.",
    "passwordResetSuccess": "Password reset successful. You can now login."
  }
}
```

**Chinese (`zh-CN.json`):**
```json
{
  "auth": {
    "login": "登录",
    "register": "注册",
    "logout": "登出",
    "email": "邮箱",
    "password": "密码",
    "forgotPassword": "忘记密码？",
    "loginSuccess": "登录成功",
    "loginFailed": "邮箱或密码无效",
    "accountLocked": "尝试次数过多。账户已锁定30分钟。",
    "emailNotVerified": "请验证您的邮箱地址。请检查您的收件箱。",
    "mfaRequired": "输入您的MFA代码",
    "registerSuccess": "注册成功。请检查您的邮箱以验证您的账户。",
    "passwordResetSent": "密码重置邮件已发送。请检查您的收件箱。",
    "passwordResetSuccess": "密码重置成功。您现在可以登录。"
  }
}
```

---

## 14. Deployment Considerations

### 14.1 Docker Configuration

**Frontend Dockerfile:** No changes needed (authentication is client-side)

**Backend Dockerfile:** Already configured (authentication module exists)

### 14.2 Environment Variables

**Production:**
- Set `CUSTOMER_JWT_SECRET` to a strong random value
- Enable HTTPS for secure token transmission
- Configure email service for verification emails

**Development:**
- Use default secret (acceptable for local development)
- Email verification can be skipped (manual verification in database)

### 14.3 Database Migrations

**Status:** Migration V0.0.43 already exists and creates all required tables.

**Action:** Run migrations in production environment.

```bash
# Backend migration is automatic via Flyway on startup
docker-compose up backend
```

---

## 15. Future Enhancements

### 15.1 Multi-Factor Authentication (MFA)

**Status:** Backend has placeholder for MFA, but not implemented.

**Implementation:**
1. Add `speakeasy` library for TOTP generation
2. Implement `customerEnrollMFA` mutation
3. Create MFA enrollment page (show QR code)
4. Add MFA code input to LoginPage
5. Store MFA secret in `customer_users.mfa_secret`

### 15.2 Social Login (OAuth)

**Providers:** Google, Microsoft

**Implementation:**
1. Add OAuth providers to `CustomerAuthService`
2. Create OAuth callback endpoint
3. Add "Sign in with Google" button to LoginPage
4. Map OAuth user to `customer_users` table

### 15.3 Email Service Integration

**Status:** Email verification is implemented but emails are not sent (TODO in code).

**Implementation:**
1. Add SendGrid/SES/Mailgun SDK
2. Create email templates (verification, password reset)
3. Implement `sendVerificationEmail()` in CustomerAuthService
4. Configure email service in environment variables

### 15.4 Session Management Dashboard

**Feature:** Allow users to view and revoke active sessions.

**Implementation:**
1. Show list of refresh tokens with metadata (device, IP, last used)
2. Add "Revoke" button to logout specific devices
3. Query `refresh_tokens` table for current user

### 15.5 Security Monitoring

**Feature:** Anomaly detection for suspicious login activity.

**Implementation:**
1. Monitor `customer_activity_log` for unusual patterns
2. Flag logins from new IP addresses/devices
3. Send email alerts for suspicious activity
4. Implement rate limiting on login endpoint

---

## 16. Conclusion

### 16.1 Summary

**Backend:** Complete and production-ready authentication system exists.

**Frontend:** No authentication layer currently implemented.

**Implementation Scope:** Frontend authentication integration only. No backend changes required.

**Estimated Effort:**
- **Phase 1 (Foundation):** 4-6 hours
- **Phase 2 (Pages):** 6-8 hours
- **Phase 3 (Route Protection):** 2-3 hours
- **Phase 4 (UI Polish):** 3-4 hours
- **Phase 5 (Testing):** 4-6 hours
- **Total:** 19-27 hours

**Priority:** HIGH (security requirement for production deployment)

### 16.2 Recommended Next Steps

1. **Marcus (Frontend Developer):** Implement Phase 1 (Foundation)
   - Create authStore
   - Update Apollo Client with auth links
   - Create GraphQL mutations/queries

2. **Marcus:** Implement Phase 2 (Authentication Pages)
   - LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, EmailVerificationPage

3. **Marcus:** Implement Phase 3 (Route Protection)
   - ProtectedRoute component
   - Update App.tsx routing

4. **Marcus:** Implement Phase 4 (UI Polish)
   - Loading states, error handling, toast notifications, i18n

5. **Billy (QA):** Test all authentication flows
   - Login, registration, logout, token refresh, email verification, password reset

6. **Berry (DevOps):** Configure production environment variables
   - Set strong `CUSTOMER_JWT_SECRET`
   - Enable HTTPS
   - Configure email service (optional for MVP)

### 16.3 Success Criteria

**Definition of Done:**
- [ ] Users cannot access dashboard routes without authentication
- [ ] Login page accepts email/password and authenticates with backend
- [ ] Registration page creates new customer users
- [ ] Token refresh works automatically and on 401 errors
- [ ] Logout clears auth state and revokes refresh token
- [ ] Email verification flow works (manual verification for MVP)
- [ ] Password reset flow works
- [ ] All GraphQL requests include Bearer token
- [ ] Multi-tab logout synchronization works
- [ ] Error messages are user-friendly and internationalized
- [ ] All authentication flows are tested and working

---

## 17. References

### 17.1 Code Locations

**Backend:**
- Authentication Module: `print-industry-erp/backend/src/modules/customer-auth/`
- GraphQL Schema: `print-industry-erp/backend/src/graphql/schema/customer-portal.graphql`
- Database Migration: `print-industry-erp/backend/migrations/V0.0.43__create_customer_portal_tables.sql`

**Frontend:**
- App Entry: `print-industry-erp/frontend/src/App.tsx`
- GraphQL Client: `print-industry-erp/frontend/src/graphql/client.ts`
- State Store: `print-industry-erp/frontend/src/store/appStore.ts`

### 17.2 Related Requirements

- **REQ-STRATEGIC-AUTO-1767048328659:** Customer Portal & Self-Service Ordering (Backend authentication implementation)
- **REQ-STRATEGIC-AUTO-1767066329939:** Frontend Authentication (This requirement)

### 17.3 External Documentation

- NestJS JWT: https://docs.nestjs.com/security/authentication
- Apollo Client Auth: https://www.apollographql.com/docs/react/networking/authentication/
- React Router v6: https://reactrouter.com/en/main/start/overview
- Zustand: https://github.com/pmndrs/zustand

---

**End of Research Deliverable**
