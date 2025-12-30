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
        isEmailVerified
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

export const CUSTOMER_RESEND_VERIFICATION_EMAIL = gql`
  mutation CustomerResendVerificationEmail {
    customerResendVerificationEmail
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
      notificationPreferences
    }
  }
`;

export const CUSTOMER_ENROLL_MFA = gql`
  mutation CustomerEnrollMFA {
    customerEnrollMFA {
      secret
      qrCodeUrl
      backupCodes
    }
  }
`;

export const CUSTOMER_VERIFY_MFA = gql`
  mutation CustomerVerifyMFA($code: String!) {
    customerVerifyMFA(code: $code)
  }
`;

export const CUSTOMER_DISABLE_MFA = gql`
  mutation CustomerDisableMFA($password: String!) {
    customerDisableMFA(password: $password)
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

export const CUSTOMER_REORDER = gql`
  mutation CustomerReorder(
    $originalOrderId: ID!
    $quantity: Int
    $requestedDeliveryDate: Date
  ) {
    customerReorder(
      originalOrderId: $originalOrderId
      quantity: $quantity
      requestedDeliveryDate: $requestedDeliveryDate
    ) {
      id
      orderNumber
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
      approvedBy
    }
  }
`;

export const CUSTOMER_REQUEST_PROOF_REVISION = gql`
  mutation CustomerRequestProofRevision($proofId: ID!, $revisionNotes: String!) {
    customerRequestProofRevision(proofId: $proofId, revisionNotes: $revisionNotes) {
      id
      status
      revisionNotes
    }
  }
`;

export const CUSTOMER_REQUEST_ARTWORK_UPLOAD = gql`
  mutation CustomerRequestArtworkUpload(
    $fileName: String!
    $fileSize: Int!
    $fileType: String!
    $quoteId: ID
    $orderId: ID
  ) {
    customerRequestArtworkUpload(
      fileName: $fileName
      fileSize: $fileSize
      fileType: $fileType
      quoteId: $quoteId
      orderId: $orderId
    ) {
      fileId
      uploadUrl
      expiresAt
    }
  }
`;

export const CUSTOMER_CONFIRM_ARTWORK_UPLOAD = gql`
  mutation CustomerConfirmArtworkUpload($fileId: ID!, $storageUrl: String!) {
    customerConfirmArtworkUpload(fileId: $fileId, storageUrl: $storageUrl) {
      id
      fileName
      fileUrl
      virusScanStatus
      uploadedAt
    }
  }
`;
