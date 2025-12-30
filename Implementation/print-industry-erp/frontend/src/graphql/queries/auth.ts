import { gql } from '@apollo/client';

export const CUSTOMER_ME = gql`
  query CustomerMe {
    customerMe {
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
      customer {
        id
        customer_name
        customer_code
      }
    }
  }
`;
