import { ApolloClient, InMemoryCache, HttpLink, from, split, Observable } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { fromPromise } from '@apollo/client/link/utils';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// Extend Window interface for global auth accessors
declare global {
  interface Window {
    __getAccessToken?: () => string | null;
    __refreshAccessToken?: () => Promise<boolean>;
    __getTenantId?: () => string | null;
    __notifyAuthorizationError?: (error: { message: string; path?: readonly unknown[] }) => void;
  }
}

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

// WebSocket link for subscriptions
const wsLink = new GraphQLWsLink(
  createClient({
    url: import.meta.env.VITE_GRAPHQL_WS_URL || 'ws://localhost:4000/graphql',
    connectionParams: () => {
      // Get access token from global accessor
      const token = window.__getAccessToken?.();
      const tenantId = window.__getTenantId?.();

      return {
        authToken: token,
        tenantId: tenantId,
      };
    },
    retryAttempts: 5,
    shouldRetry: () => true,
    on: {
      connected: () => console.log('WebSocket connected'),
      error: (error) => console.error('WebSocket error:', error),
      closed: () => console.log('WebSocket closed'),
    },
  })
);

// Auth link - inject Bearer token and tenant context
const authLink = setContext((_, { headers }) => {
  // Get access token from global accessor (set by auth store)
  const token = window.__getAccessToken?.();

  // Get tenant ID from global accessor (set by app store)
  const tenantId = window.__getTenantId?.();

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      // Include tenant ID in headers for additional validation
      'x-tenant-id': tenantId || '',
    },
  };
});

// Error link - handle 401, 403, and token refresh
const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const errorCode = err.extensions?.code as string;

      // Handle authentication errors (401)
      if (errorCode === 'UNAUTHENTICATED') {
        // Get retry count from operation context
        const retryCount = operation.getContext().retryCount || 0;

        if (retryCount >= 2) {
          // Max retries exceeded, clear auth and redirect
          const refreshFn = window.__refreshAccessToken;
          if (refreshFn) {
            refreshFn().then((success: boolean) => {
              if (!success) {
                window.location.href = '/login';
              }
            });
          }
          return;
        }

        // Increment retry count
        operation.setContext({ retryCount: retryCount + 1 });

        // Attempt token refresh
        const refreshFn = window.__refreshAccessToken;
        if (refreshFn) {
          return fromPromise(
            refreshFn().then((success: boolean) => {
              if (success) {
                return true;
              } else {
                window.location.href = '/login';
                return false;
              }
            })
          ).flatMap((success) => {
            if (success) {
              return forward(operation);
            }
            return Observable.of();
          });
        }
      }

      // Handle authorization errors (403) - Tenant isolation violations
      if (errorCode === 'FORBIDDEN') {
        console.error('Tenant isolation violation:', err.message);

        // Notify user of authorization failure
        const notifyFn = window.__notifyAuthorizationError;
        if (notifyFn) {
          notifyFn({
            message: err.message,
            path: err.path,
          });
        }

        // Don't retry authorization errors
        return;
      }
    }
  }
});

// Split link - use WebSocket for subscriptions, HTTP for queries/mutations
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([authLink, errorLink, httpLink])
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Quote: {
        keyFields: ['id'],
        fields: {
          version: {
            merge: false, // Don't merge, always take incoming value
          },
        },
      },
      QuoteLine: {
        keyFields: ['id'],
        fields: {
          version: {
            merge: false, // Don't merge, always take incoming value
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

// Setup global accessors for auth and tenant context (to avoid circular dependency)
// These will be initialized by the auth store and app store
if (typeof window !== 'undefined') {
  window.__getAccessToken = () => null;
  window.__refreshAccessToken = async () => false;
  window.__getTenantId = () => null;
  window.__notifyAuthorizationError = (error: { message: string; path?: readonly unknown[] }) => {
    console.error('Authorization error:', error);
  };
}
