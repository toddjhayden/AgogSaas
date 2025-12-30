import { ApolloClient, InMemoryCache, HttpLink, from, fromPromise } from '@apollo/client';
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

// Token refresh function
const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem('customerRefreshToken');
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // Call refresh token mutation
  const response = await fetch(import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation CustomerRefreshToken($refreshToken: String!) {
          customerRefreshToken(refreshToken: $refreshToken) {
            accessToken
            refreshToken
            expiresAt
          }
        }
      `,
      variables: { refreshToken },
    }),
  });

  const result = await response.json();

  if (result.errors) {
    throw new Error('Token refresh failed');
  }

  const { accessToken, refreshToken: newRefreshToken, expiresAt } = result.data.customerRefreshToken;

  // Update tokens in localStorage
  localStorage.setItem('customerAccessToken', accessToken);
  localStorage.setItem('customerRefreshToken', newRefreshToken);
  localStorage.setItem('customerTokenExpiresAt', expiresAt);

  return accessToken;
};

// Error link - handles 401 errors and token refresh
// Implementation follows Sylvia's recommendation to prevent infinite loops
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED') {
        // Check if already retried (prevent infinite loop per Sylvia's critique)
        const oldHeaders = operation.getContext().headers;
        if (oldHeaders['x-token-refresh-attempted']) {
          // Already tried refresh, redirect to login
          localStorage.removeItem('customerAccessToken');
          localStorage.removeItem('customerRefreshToken');
          localStorage.removeItem('customerTokenExpiresAt');
          window.location.href = '/portal/login';
          return;
        }

        // Attempt token refresh
        return fromPromise(
          refreshAccessToken()
            .then((newToken) => {
              operation.setContext({
                headers: {
                  ...oldHeaders,
                  authorization: `Bearer ${newToken}`,
                  'x-token-refresh-attempted': 'true',
                },
              });
            })
            .catch(() => {
              // Refresh failed, clear tokens and redirect
              localStorage.removeItem('customerAccessToken');
              localStorage.removeItem('customerRefreshToken');
              localStorage.removeItem('customerTokenExpiresAt');
              window.location.href = '/portal/login';
              return;
            })
        ).flatMap(() => forward(operation));
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
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          customerOrders: {
            keyArgs: ['status', 'dateFrom', 'dateTo'],
            merge(existing, incoming, { args }) {
              // Handle pagination merge
              if (!existing || args?.offset === 0) {
                return incoming;
              }
              return {
                ...incoming,
                orders: [...(existing.orders || []), ...(incoming.orders || [])],
              };
            },
          },
          customerQuotes: {
            keyArgs: ['status'],
            merge(existing, incoming, { args }) {
              if (!existing || args?.offset === 0) {
                return incoming;
              }
              return {
                ...incoming,
                quotes: [...(existing.quotes || []), ...(incoming.quotes || [])],
              };
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});
