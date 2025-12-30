# Research Deliverable: Customer Portal Authentication - Email & TOTP
**REQ-STRATEGIC-AUTO-1767103864617**
**Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## Executive Summary

This research analyzes the current state of Customer Portal Authentication with a focus on **Email Verification** and **TOTP (Time-based One-Time Password) Multi-Factor Authentication**. The infrastructure foundation has been established through REQ-STRATEGIC-AUTO-1767048328659, but critical authentication features remain unimplemented as placeholder TODOs.

**Key Finding:** The authentication system is **80% complete** with robust database schema, JWT token management, and GraphQL resolvers in place. However, two critical security features are missing:
1. **Email Service Integration** - Email verification and password reset emails not sent
2. **TOTP/MFA Implementation** - Multi-factor authentication uses placeholder validation

---

## Current Implementation Status

### ✅ What's Working (Implemented)

#### 1. Database Schema (V0.0.43)
- **customer_users table** with comprehensive security features:
  - Password hashing (bcrypt with salt rounds >= 10)
  - Account lockout after 5 failed login attempts (30-minute lockout)
  - Email verification fields (`email_verification_token`, `email_verification_expires`)
  - MFA fields (`mfa_enabled`, `mfa_secret`, `mfa_backup_codes`)
  - Row-Level Security (RLS) for multi-tenant isolation

#### 2. JWT Token Management
- **Access tokens**: 30 minutes (short-lived, secure)
- **Refresh tokens**: 14 days (stored hashed in database)
- Token rotation on refresh
- Revocation on password change/logout
- Separate `refresh_tokens` table with audit trail

#### 3. Authentication Service (`customer-auth.service.ts`)
- **Registration** with email verification token generation
- **Login** with password validation and failed attempt tracking
- **Password reset** token generation and validation
- **Password change** with old password verification
- **MFA enrollment** and verification (placeholder implementation)
- Activity logging to `customer_activity_log` table

#### 4. GraphQL Resolvers (`customer-portal.resolver.ts`)
Complete implementation of all authentication mutations and queries:
- `customerRegister`, `customerLogin`, `customerLogout`
- `customerRequestPasswordReset`, `customerResetPassword`
- `customerVerifyEmail`, `customerResendVerificationEmail`
- `customerEnrollMFA`, `customerVerifyMFA`, `customerDisableMFA`
- `customerMe`, `customerUpdateProfile`

#### 5. Security Features
- Password complexity validation (PasswordService)
- Account lockout trigger (`lock_customer_account_on_failed_login()`)
- Cleanup function for expired tokens (`cleanup_expired_customer_portal_data()`)
- Activity logging for security events (LOGIN, LOGOUT, MFA_ENABLED, etc.)

---

## ❌ Missing Implementation (TODOs)

### 1. Email Service Integration

**Critical Gap:** Email notifications are not sent, preventing users from:
- Verifying their email addresses after registration
- Resetting forgotten passwords
- Receiving account security notifications

**TODO Locations:**
```typescript
// customer-auth.service.ts:116
// TODO: Send verification email via email service
// await this.emailService.sendVerificationEmail(user.email, verificationToken);

// customer-portal.resolver.ts:102
// TODO: Send password reset email
// await this.emailService.sendPasswordResetEmail(email, resetToken);

// customer-portal.resolver.ts:289
// TODO: Send verification email
// await this.emailService.sendVerificationEmail(userResult.rows[0].email, verificationToken);
```

**Impact:**
- Users can register but cannot verify their email (blocked from login per line 175 of customer-auth.service.ts)
- Password reset workflow is non-functional (token generated but never delivered)
- Poor user experience and security risk (unverified accounts)

**Dependencies Required:**
- Email service library: **nodemailer** (most common for Node.js)
- SMTP configuration in `.env`:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - `EMAIL_FROM` (e.g., "noreply@agog.com")
- Email templates (HTML/text) for:
  - Email verification (with clickable link + token)
  - Password reset (with secure reset link)
  - Account lockout notification
  - MFA enrollment confirmation

---

### 2. TOTP/MFA Implementation

**Critical Gap:** Multi-factor authentication is stubbed with placeholders, providing no actual security benefit.

**TODO Locations:**
```typescript
// customer-portal.resolver.ts:312-316
// TODO: Generate TOTP secret and QR code using speakeasy
const secret = 'PLACEHOLDER_SECRET';
const qrCodeUrl = 'https://placeholder.qr';
const backupCodes = ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5'];

// customer-portal.resolver.ts:340-344
// TODO: Verify TOTP code using speakeasy
// For MVP, accept any 6-digit code
if (!/^\d{6}$/.test(code)) {
  throw new BadRequestException('Invalid MFA code format');
}

// customer-auth.service.ts:355-358
// TODO: Implement TOTP validation using speakeasy or similar library
// For now, return false (MFA not implemented yet)
return false;
```

**Impact:**
- MFA enrollment appears to work but provides no actual security
- Login with MFA enabled will fail (validation always returns false at line 357)
- Backup codes are fake placeholders
- QR code generation missing (users cannot add to authenticator apps)

**Dependencies Required:**
- **speakeasy** library for TOTP generation and validation
- **qrcode** library for generating QR code images
- Secure random backup code generation
- Database storage for backup codes (already in schema: `mfa_backup_codes` JSONB)

---

## Architecture Analysis

### Authentication Flow (Current State)

```
┌─────────────────────────────────────────────────────────────┐
│ Registration Flow                                            │
├─────────────────────────────────────────────────────────────┤
│ 1. User submits registration (customerRegister mutation)    │
│ 2. Validate customer code + email uniqueness                │
│ 3. Hash password with bcrypt                                │
│ 4. Generate email verification token                        │
│ 5. Insert into customer_users table                         │
│ 6. ⚠️  TODO: Send verification email                        │
│ 7. Return JWT tokens (but user cannot use until verified)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Login Flow                                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. User submits email + password (+ optional MFA code)      │
│ 2. Validate credentials                                     │
│ 3. Check account lockout status                             │
│ 4. Validate password hash                                   │
│ 5. If MFA enabled:                                          │
│    ⚠️  TODO: Validate TOTP code (currently always fails)    │
│ 6. Check email verification (required)                      │
│ 7. Generate access + refresh tokens                         │
│ 8. Store refresh token hash in database                     │
│ 9. Log LOGIN activity                                       │
│ 10. Return tokens + user info                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Password Reset Flow                                          │
├─────────────────────────────────────────────────────────────┤
│ 1. User requests password reset (email)                     │
│ 2. Generate reset token (1 hour expiry)                     │
│ 3. Store token in database                                  │
│ 4. ⚠️  TODO: Send reset email with link                     │
│ 5. User clicks link with token                              │
│ 6. Validate token + expiry                                  │
│ 7. Update password hash                                     │
│ 8. Revoke all refresh tokens (force re-login)               │
│ 9. Log PASSWORD_RESET activity                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MFA Enrollment Flow                                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Authenticated user enrolls in MFA                        │
│ 2. ⚠️  TODO: Generate TOTP secret with speakeasy            │
│ 3. ⚠️  TODO: Generate QR code for authenticator app         │
│ 4. ⚠️  TODO: Generate real backup codes                     │
│ 5. Store MFA secret (NOT enabled yet)                       │
│ 6. User scans QR code in Google Authenticator               │
│ 7. User submits TOTP code to verify                         │
│ 8. ⚠️  TODO: Validate TOTP code                             │
│ 9. Enable MFA (set mfa_enabled = TRUE)                      │
│ 10. Log MFA_ENABLED activity                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies Analysis

### Current Dependencies (package.json)
```json
{
  "bcrypt": "^5.1.1",           // ✅ Password hashing (working)
  "@nestjs/jwt": "^10.2.0",     // ✅ JWT generation/validation (working)
  "@nestjs/passport": "^10.0.3", // ✅ Authentication guards (working)
  "passport-jwt": "^4.0.1",     // ✅ JWT strategy (working)
  "pg": "^8.11.3"               // ✅ PostgreSQL client (working)
}
```

### Missing Dependencies (REQUIRED)
```json
{
  "nodemailer": "^6.9.0",       // ❌ SMTP email sending
  "speakeasy": "^2.0.0",        // ❌ TOTP generation/validation
  "qrcode": "^1.5.0",           // ❌ QR code generation for MFA
  "@types/nodemailer": "^6.4.0", // ❌ TypeScript types (dev dependency)
  "@types/speakeasy": "^2.0.0",  // ❌ TypeScript types (dev dependency)
  "@types/qrcode": "^1.5.0"     // ❌ TypeScript types (dev dependency)
}
```

---

## Security Considerations

### ✅ Implemented Security Best Practices
1. **Password Hashing:** bcrypt with salt rounds >= 10
2. **Account Lockout:** 5 failed attempts = 30-minute lockout
3. **Token Expiry:** Access tokens 30 min, refresh tokens 14 days
4. **Token Rotation:** New refresh token on each refresh request
5. **Token Revocation:** On password change, logout, security events
6. **Row-Level Security:** Multi-tenant isolation at database level
7. **Activity Logging:** All authentication events logged
8. **HTTPS Enforcement:** Assumed for production (recommended in deployment)

### ⚠️ Security Gaps (Due to Missing Implementation)
1. **No Email Verification:** Accounts can be created with fake emails
2. **Non-Functional MFA:** Security theater (appears enabled but doesn't work)
3. **No Password Reset:** Users locked out of accounts permanently if they forget password
4. **No Security Notifications:** Users not notified of account lockouts, MFA changes, etc.

---

## Recommendations

### Priority 1: Email Service Implementation (CRITICAL)
**Estimated Effort:** 4-6 hours
**Impact:** HIGH (blocks user registration and password reset)

**Implementation Steps:**
1. Install dependencies:
   ```bash
   npm install nodemailer @types/nodemailer
   ```

2. Create `src/common/services/email.service.ts`:
   ```typescript
   import * as nodemailer from 'nodemailer';
   import { Injectable } from '@nestjs/common';
   import { ConfigService } from '@nestjs/config';

   @Injectable()
   export class EmailService {
     private transporter: nodemailer.Transporter;

     constructor(private configService: ConfigService) {
       this.transporter = nodemailer.createTransport({
         host: this.configService.get('SMTP_HOST'),
         port: this.configService.get('SMTP_PORT'),
         secure: true, // TLS
         auth: {
           user: this.configService.get('SMTP_USER'),
           pass: this.configService.get('SMTP_PASS'),
         },
       });
     }

     async sendVerificationEmail(email: string, token: string) {
       const verifyUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;

       await this.transporter.sendMail({
         from: this.configService.get('EMAIL_FROM'),
         to: email,
         subject: 'Verify Your Email Address',
         html: `
           <h1>Welcome to AGOG Print ERP</h1>
           <p>Please verify your email address by clicking the link below:</p>
           <a href="${verifyUrl}">Verify Email</a>
           <p>This link expires in 24 hours.</p>
         `,
       });
     }

     async sendPasswordResetEmail(email: string, token: string) {
       const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

       await this.transporter.sendMail({
         from: this.configService.get('EMAIL_FROM'),
         to: email,
         subject: 'Password Reset Request',
         html: `
           <h1>Password Reset</h1>
           <p>You requested a password reset. Click the link below:</p>
           <a href="${resetUrl}">Reset Password</a>
           <p>This link expires in 1 hour.</p>
           <p>If you didn't request this, please ignore this email.</p>
         `,
       });
     }
   }
   ```

3. Update `.env.example` and `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM="AGOG Print ERP <noreply@agog.com>"
   FRONTEND_URL=http://localhost:3000
   ```

4. Replace TODO comments in:
   - `customer-auth.service.ts:116`
   - `customer-portal.resolver.ts:102`
   - `customer-portal.resolver.ts:289`

---

### Priority 2: TOTP/MFA Implementation (HIGH)
**Estimated Effort:** 6-8 hours
**Impact:** HIGH (security feature advertised but non-functional)

**Implementation Steps:**
1. Install dependencies:
   ```bash
   npm install speakeasy qrcode @types/speakeasy @types/qrcode
   ```

2. Create `src/common/services/mfa.service.ts`:
   ```typescript
   import * as speakeasy from 'speakeasy';
   import * as QRCode from 'qrcode';
   import { Injectable } from '@nestjs/common';
   import { randomBytes } from 'crypto';

   @Injectable()
   export class MfaService {
     /**
      * Generate TOTP secret and QR code
      */
     async generateMfaSecret(email: string, issuer: string = 'AGOG Print ERP') {
       const secret = speakeasy.generateSecret({
         name: `${issuer} (${email})`,
         issuer,
         length: 32,
       });

       // Generate QR code as data URL
       const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

       // Generate backup codes (8 codes, 8 characters each)
       const backupCodes = Array.from({ length: 8 }, () =>
         randomBytes(4).toString('hex').toUpperCase()
       );

       return {
         secret: secret.base32,
         qrCodeUrl,
         backupCodes,
       };
     }

     /**
      * Verify TOTP code
      */
     verifyTotp(secret: string, code: string): boolean {
       return speakeasy.totp.verify({
         secret,
         encoding: 'base32',
         token: code,
         window: 1, // Allow 1 step before/after (30 seconds tolerance)
       });
     }

     /**
      * Verify backup code
      */
     verifyBackupCode(backupCodes: string[], code: string): boolean {
       return backupCodes.includes(code.toUpperCase());
     }
   }
   ```

3. Update `customer-portal.resolver.ts:312-316`:
   ```typescript
   @Mutation()
   @UseGuards(CustomerAuthGuard)
   async customerEnrollMFA(@CurrentCustomerUser() user: CustomerUserPayload) {
     const userResult = await this.dbPool.query(
       `SELECT mfa_enabled, email FROM customer_users WHERE id = $1`,
       [user.userId],
     );

     if (userResult.rows[0].mfa_enabled) {
       throw new BadRequestException('MFA already enabled');
     }

     const { secret, qrCodeUrl, backupCodes } = await this.mfaService.generateMfaSecret(
       userResult.rows[0].email
     );

     await this.dbPool.query(
       `UPDATE customer_users
        SET mfa_secret = $1, mfa_backup_codes = $2
        WHERE id = $3`,
       [secret, JSON.stringify(backupCodes), user.userId],
     );

     return { secret, qrCodeUrl, backupCodes };
   }
   ```

4. Update `customer-portal.resolver.ts:340-344`:
   ```typescript
   @Mutation()
   @UseGuards(CustomerAuthGuard)
   async customerVerifyMFA(
     @CurrentCustomerUser() user: CustomerUserPayload,
     @Args('code') code: string,
   ): Promise<boolean> {
     const userResult = await this.dbPool.query(
       `SELECT mfa_secret FROM customer_users WHERE id = $1`,
       [user.userId],
     );

     if (!userResult.rows[0].mfa_secret) {
       throw new BadRequestException('MFA not enrolled');
     }

     const isValid = this.mfaService.verifyTotp(
       userResult.rows[0].mfa_secret,
       code
     );

     if (!isValid) {
       throw new UnauthorizedException('Invalid MFA code');
     }

     await this.dbPool.query(
       `UPDATE customer_users SET mfa_enabled = TRUE WHERE id = $1`,
       [user.userId],
     );

     await this.logActivity(user.userId, user.tenantId, 'MFA_ENABLED', null);

     return true;
   }
   ```

5. Update `customer-auth.service.ts:354-358`:
   ```typescript
   private async validateMfaCode(userId: string, code: string): Promise<boolean> {
     const userResult = await this.dbPool.query(
       `SELECT mfa_secret, mfa_backup_codes FROM customer_users WHERE id = $1`,
       [userId],
     );

     if (!userResult.rows[0]) return false;

     const { mfa_secret, mfa_backup_codes } = userResult.rows[0];

     // Try TOTP validation first
     if (this.mfaService.verifyTotp(mfa_secret, code)) {
       return true;
     }

     // Try backup code if TOTP fails
     const backupCodes = mfa_backup_codes ? JSON.parse(mfa_backup_codes) : [];
     if (this.mfaService.verifyBackupCode(backupCodes, code)) {
       // Remove used backup code
       const remainingCodes = backupCodes.filter(c => c !== code.toUpperCase());
       await this.dbPool.query(
         `UPDATE customer_users SET mfa_backup_codes = $1 WHERE id = $2`,
         [JSON.stringify(remainingCodes), userId],
       );
       return true;
     }

     return false;
   }
   ```

---

### Priority 3: Enhanced Security Features (MEDIUM)
**Estimated Effort:** 4-6 hours
**Impact:** MEDIUM (improves security posture)

1. **Email Notifications for Security Events:**
   - Account lockout notification
   - Password changed notification
   - MFA enabled/disabled notification
   - New login from unrecognized device

2. **Session Management:**
   - Track active sessions (device fingerprinting)
   - Allow users to view/revoke active sessions
   - Limit concurrent sessions per user

3. **Advanced MFA Features:**
   - Trusted device management (remember device for 30 days)
   - SMS backup option (Twilio integration)
   - Recovery email option

---

## Testing Recommendations

### Unit Tests Required
1. **Email Service:**
   - Test SMTP connection
   - Verify email template rendering
   - Mock email sending in tests

2. **MFA Service:**
   - Test TOTP generation and validation
   - Test backup code generation and verification
   - Test time window tolerance (30 seconds)

3. **Authentication Service:**
   - Test email verification flow
   - Test password reset flow
   - Test MFA enrollment and login

### Integration Tests Required
1. **End-to-End Registration:**
   - Register → Receive email → Verify → Login

2. **Password Reset Flow:**
   - Request reset → Receive email → Reset password → Login

3. **MFA Enrollment Flow:**
   - Enroll → Scan QR code → Verify → Login with MFA

### Security Tests Required
1. **Token Expiry:** Verify expired tokens are rejected
2. **Account Lockout:** Test 5 failed login attempts
3. **MFA Bypass:** Ensure MFA cannot be bypassed
4. **Email Verification:** Ensure unverified users cannot login

---

## Migration Plan (No Database Changes Required)

**Good News:** The database schema from V0.0.43 already supports all required features:
- `email_verification_token`, `email_verification_expires`
- `password_reset_token`, `password_reset_expires`
- `mfa_enabled`, `mfa_secret`, `mfa_backup_codes`

**No new migrations needed.** Only application code changes required.

---

## Deployment Checklist

### Pre-Deployment
- [ ] Install npm dependencies (nodemailer, speakeasy, qrcode)
- [ ] Configure SMTP credentials in `.env`
- [ ] Create email templates (HTML/text)
- [ ] Test email delivery in staging environment
- [ ] Test TOTP generation/validation
- [ ] Update GraphQL schema documentation

### Post-Deployment
- [ ] Monitor email delivery success rate
- [ ] Monitor MFA enrollment adoption
- [ ] Review customer_activity_log for anomalies
- [ ] Set up alerts for account lockouts
- [ ] Document user-facing MFA setup guide

---

## Cost Analysis

### SMTP Service Options
1. **Gmail (Free tier):**
   - 500 emails/day limit
   - Suitable for MVP/testing
   - Requires app-specific password

2. **SendGrid (Free tier):**
   - 100 emails/day
   - Better deliverability than Gmail
   - API-based (optional)

3. **AWS SES (Production):**
   - $0.10 per 1,000 emails
   - High deliverability
   - Requires domain verification

**Recommendation:** Start with Gmail for MVP, migrate to AWS SES for production.

---

## Conclusion

The Customer Portal Authentication system has a **solid foundation** with comprehensive database schema, JWT token management, and GraphQL resolvers. However, two critical features are missing:

1. **Email Service Integration:** Required for email verification and password reset workflows
2. **TOTP/MFA Implementation:** Required for multi-factor authentication security

**Total Effort Estimate:** 10-14 hours (1-2 developer days)

**Risk Assessment:**
- **Low Risk:** Database schema already supports all features
- **Medium Risk:** SMTP configuration may require domain verification
- **Low Risk:** Well-documented libraries (nodemailer, speakeasy)

**Business Impact:**
- **High:** Blocks customer portal launch (email verification required for login)
- **High:** Security risk (advertised MFA doesn't actually work)
- **Medium:** Poor user experience (cannot reset passwords)

**Recommendation:** Prioritize implementation before customer portal production launch.

---

## File References

### Key Files Analyzed
1. `backend/src/modules/customer-auth/customer-auth.service.ts` (413 lines)
2. `backend/src/modules/customer-portal/customer-portal.resolver.ts` (1,459 lines)
3. `backend/migrations/V0.0.43__create_customer_portal_tables.sql` (478 lines)
4. `backend/src/graphql/schema/customer-portal.graphql` (415 lines)
5. `backend/package.json` (90 lines)

### TODO Locations
- Email Service: Lines 116, 102, 289
- TOTP/MFA: Lines 312-316, 340-344, 354-358

---

**End of Research Deliverable**

*This document provides a comprehensive analysis of the Customer Portal Authentication system with specific recommendations for completing the Email and TOTP implementation.*
