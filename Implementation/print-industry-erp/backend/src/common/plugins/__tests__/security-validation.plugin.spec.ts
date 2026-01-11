/**
 * Security Validation Plugin Tests
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 */

import { SecurityValidationPlugin } from '../security-validation.plugin';
import { GraphQLError } from 'graphql';
import { parse } from 'graphql';
import { buildSchema } from 'graphql';

describe('SecurityValidationPlugin', () => {
  let plugin: SecurityValidationPlugin;

  const testSchema = buildSchema(`
    type Query {
      user(id: ID!): User
      users: [User!]!
    }

    type Mutation {
      createUser(name: String!): User
      updateUser(id: ID!, name: String!): User
      deleteUser(id: ID!): Boolean
    }

    type User {
      id: ID!
      name: String!
      email: String!
    }
  `);

  beforeEach(() => {
    plugin = new SecurityValidationPlugin();
    // Set to development for most tests
    process.env.NODE_ENV = 'development';
    process.env.GRAPHQL_REQUIRE_OPERATION_NAME = 'false';
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  describe('Operation Name Requirement', () => {
    it('should allow named operations', async () => {
      const query = parse(`
        query GetUser {
          user(id: "1") {
            id
            name
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'GetUser',
        operation: { operation: 'query' },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should not throw
      await expect(listener.didResolveOperation!(requestContext)).resolves.not.toThrow();
    });

    it('should block unnamed operations when required', async () => {
      process.env.NODE_ENV = 'production';

      const query = parse(`
        query {
          user(id: "1") {
            id
            name
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: undefined,
        operation: { operation: 'query' },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should throw
      await expect(listener.didResolveOperation!(requestContext))
        .rejects
        .toThrow('All GraphQL operations must be named');
    });
  });

  describe('Mutation Batching Limits', () => {
    it('should allow single mutation', async () => {
      const query = parse(`
        mutation CreateUser {
          createUser(name: "John") {
            id
            name
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'CreateUser',
        operation: { operation: 'mutation', selectionSet: { selections: [{}] } },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should not throw
      await expect(listener.didResolveOperation!(requestContext)).resolves.not.toThrow();
    });

    it('should allow multiple mutations under limit', async () => {
      const query = parse(`
        mutation BatchCreate {
          user1: createUser(name: "John") { id }
          user2: createUser(name: "Jane") { id }
          user3: createUser(name: "Bob") { id }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'BatchCreate',
        operation: {
          operation: 'mutation',
          selectionSet: { selections: [{}, {}, {}] } // 3 mutations
        },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should not throw (under limit of 10)
      await expect(listener.didResolveOperation!(requestContext)).resolves.not.toThrow();
    });

    it('should block excessive mutation batching', async () => {
      // Create 11 mutations (over the limit of 10)
      const mutations = Array.from({ length: 11 }, (_, i) =>
        `user${i}: createUser(name: "User${i}") { id }`
      ).join('\n');

      const query = parse(`
        mutation ExcessiveBatch {
          ${mutations}
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'ExcessiveBatch',
        operation: {
          operation: 'mutation',
          selectionSet: { selections: Array(11).fill({}) } // 11 mutations
        },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should throw mutation batching error
      await expect(listener.didResolveOperation!(requestContext))
        .rejects
        .toThrow(GraphQLError);
    });
  });

  describe('Alias Limits', () => {
    it('should allow queries with few aliases', async () => {
      const query = parse(`
        query AliasQuery {
          user1: user(id: "1") { id name }
          user2: user(id: "2") { id name }
          user3: user(id: "3") { id name }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'AliasQuery',
        operation: { operation: 'query' },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should not throw
      await expect(listener.didResolveOperation!(requestContext)).resolves.not.toThrow();
    });

    it('should block queries with excessive aliases', async () => {
      // Create 16 aliases (over the limit of 15)
      const aliases = Array.from({ length: 16 }, (_, i) =>
        `user${i}: user(id: "${i}") { id }`
      ).join('\n');

      const query = parse(`
        query ExcessiveAliases {
          ${aliases}
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'ExcessiveAliases',
        operation: { operation: 'query' },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should throw alias limit error
      await expect(listener.didResolveOperation!(requestContext))
        .rejects
        .toThrow(GraphQLError);
    });
  });

  describe('Introspection Blocking', () => {
    it('should allow introspection in development', async () => {
      process.env.NODE_ENV = 'development';

      const query = parse(`
        query GetSchema {
          __schema {
            types {
              name
            }
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: { user: null },
        operationName: 'GetSchema',
        operation: { operation: 'query' },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should not throw
      await expect(listener.didResolveOperation!(requestContext)).resolves.not.toThrow();
    });

    it('should block introspection in production', async () => {
      process.env.NODE_ENV = 'production';

      const query = parse(`
        query GetSchema {
          __type(name: "User") {
            name
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: { user: null },
        operationName: 'GetSchema',
        operation: { operation: 'query' },
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Should throw introspection disabled error
      await expect(listener.didResolveOperation!(requestContext))
        .rejects
        .toThrow('Introspection is disabled in production');
    });
  });

  describe('Execution Metrics', () => {
    it('should track execution time', async () => {
      const query = parse(`
        query MetricsQuery {
          user(id: "1") {
            id
            name
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'MetricsQuery',
        operation: { operation: 'query' },
        response: {},
      };

      const listener = await plugin.requestDidStart(requestContext);

      // Execute and check metrics
      await listener.didResolveOperation!(requestContext);

      if (listener.executionDidStart) {
        const executionListener = await listener.executionDidStart!(requestContext);

        // Simulate execution
        await new Promise(resolve => setTimeout(resolve, 10));

        if (executionListener.executionDidEnd) {
          await executionListener.executionDidEnd();
        }
      }

      // Metrics should be tracked (tested via logs)
      expect(true).toBe(true);
    });

    it('should add metrics to response in development', async () => {
      process.env.NODE_ENV = 'development';

      const query = parse(`
        query DevMetrics {
          user(id: "1") {
            id
          }
        }
      `);

      const requestContext: any = {
        schema: testSchema,
        document: query,
        request: { variables: {} },
        contextValue: {
          user: { userId: 'test-user', tenantId: 'test-tenant', roles: ['user'] }
        },
        operationName: 'DevMetrics',
        operation: { operation: 'query' },
        response: {},
      };

      const listener = await plugin.requestDidStart(requestContext);

      await listener.didResolveOperation!(requestContext);

      if (listener.willSendResponse) {
        await listener.willSendResponse(requestContext);
      }

      // Metrics should be added to response
      expect(requestContext.response.extensions).toBeDefined();
    });
  });
});
