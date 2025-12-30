/**
 * Tenant Context Plugin
 * Apollo Server plugin for managing database connections and tenant context
 *
 * REQ: REQ-STRATEGIC-AUTO-1767066329944
 * Security: GraphQL Authorization & Tenant Isolation
 *
 * Responsibilities:
 * 1. Release database connections after each request
 * 2. Ensure no connection leaks
 * 3. Clean up tenant context properly
 */

import { Plugin } from '@nestjs/apollo';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from 'apollo-server-plugin-base';
import { Logger } from '@nestjs/common';

@Plugin()
export class TenantContextPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(TenantContextPlugin.name);

  async requestDidStart(): Promise<GraphQLRequestListener> {
    return {
      /**
       * Called after the response is sent
       * Clean up database connection from context
       */
      async willSendResponse(requestContext) {
        const dbClient = requestContext.context.dbClient;

        if (dbClient) {
          try {
            // Release the database client back to the pool
            dbClient.release();
            this.logger.debug('Database client released for tenant context');
          } catch (error) {
            this.logger.error('Failed to release database client', error);
          }
        }
      },

      /**
       * Called if an error occurs during request execution
       * Ensure cleanup happens even on errors
       */
      async didEncounterErrors(requestContext) {
        const dbClient = requestContext.context.dbClient;

        if (dbClient) {
          try {
            // Release the database client back to the pool
            dbClient.release();
            this.logger.warn('Database client released after error');
          } catch (error) {
            this.logger.error('Failed to release database client after error', error);
          }
        }
      },
    };
  }
}
