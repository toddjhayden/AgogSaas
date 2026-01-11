/**
 * GraphQL Security Module - Export Index
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 */

export { GraphQLSecurityModule } from './graphql-security.module';
export { ComplexityConfigService } from './complexity-config.service';
export type {
  FieldComplexityConfig,
  ComplexityLimits,
  DepthLimits,
  ComplexityStats,
} from './complexity-config.service';
