import { gql } from '@apollo/client';

export const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($input: UpdateUserPreferencesInput!) {
    updateMyPreferences(input: $input) {
      id
      preferredLanguage
      preferredTimezone
      preferredCurrencyCode
      uiTheme
    }
  }
`;
