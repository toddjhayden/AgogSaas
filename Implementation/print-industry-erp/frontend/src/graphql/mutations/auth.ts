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
        tenantId
        email
        firstName
        lastName
        role
        mfaEnabled
        isEmailVerified
        preferredLanguage
        timezone
        lastLoginAt
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
      user {
        id
        customerId
        tenantId
        email
        firstName
        lastName
        role
        mfaEnabled
        isEmailVerified
        preferredLanguage
        timezone
        lastLoginAt
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

export const CUSTOMER_REFRESH_TOKEN = gql`
  mutation CustomerRefreshToken($refreshToken: String!) {
    customerRefreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      expiresAt
      user {
        id
        customerId
        tenantId
        email
        firstName
        lastName
        role
        mfaEnabled
        isEmailVerified
        preferredLanguage
        timezone
        lastLoginAt
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
