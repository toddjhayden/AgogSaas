/**
 * Monitoring GraphQL Module
 * Exports monitoring schema and resolvers
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Read GraphQL schema from .graphql file
export const monitoringTypeDefs = readFileSync(
  join(__dirname, 'schema.graphql'),
  'utf-8'
);

export { monitoringResolvers } from './resolvers';
