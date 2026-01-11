# GraphQL Security Plugins

**REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening**

This directory contains GraphQL security plugins that protect the API from abuse, denial-of-service attacks, and excessive resource consumption.

## Overview

The GraphQL security layer consists of four main components:

1. **Query Complexity Plugin** - Prevents expensive queries
2. **Query Depth Limiter Plugin** - Prevents deeply nested queries
3. **Security Validation Plugin** - Enforces security best practices
4. **Tenant Context Plugin** - Manages database connections and tenant isolation

## Plugins

### 1. Query Complexity Plugin

**File:** `query-complexity.plugin.ts`

Calculates and enforces query complexity limits to prevent resource exhaustion.

#### Features
- Automatic complexity calculation using field estimators
- Role-based complexity limits
- Introspection blocking in production
- Expensive query tracking

#### Configuration

Environment variables:
```bash
GRAPHQL_MAX_COMPLEXITY=1000          # Default authenticated users
GRAPHQL_MAX_COMPLEXITY_ADMIN=5000    # Admin users
GRAPHQL_MAX_COMPLEXITY_PUBLIC=100    # Anonymous users
```

#### Complexity Limits

| Role | Default Limit |
|------|--------------|
| Public | 100 |
| Authenticated | 1,000 |
| Admin | 5,000 |
| System Admin | 5,000 |

#### Example

```graphql
# Simple query (complexity: ~10)
query GetUser {
  user(id: "123") {
    id
    name
    email
  }
}

# Complex query (complexity: ~500)
query GetUserWithRelations {
  user(id: "123") {
    id
    name
    posts {
      id
      title
      comments {
        id
        text
        author {
          id
          name
        }
      }
    }
  }
}
```

### 2. Query Depth Limiter Plugin

**File:** `query-depth-limiter.plugin.ts`

Prevents deeply nested queries that can cause performance issues.

#### Features
- Recursive depth calculation
- Fragment spread tracking
- Circular fragment detection
- Role-based depth limits

#### Configuration

Environment variables:
```bash
GRAPHQL_MAX_DEPTH=7          # Default authenticated users
GRAPHQL_MAX_DEPTH_ADMIN=15   # Admin users
GRAPHQL_MAX_DEPTH_PUBLIC=5   # Anonymous users
```

#### Depth Limits

| Role | Default Limit |
|------|--------------|
| Public | 5 |
| Authenticated | 7 |
| Admin | 15 |
| System Admin | 20 |

#### Example

```graphql
# Depth 3 query
query ShallowQuery {
  user {           # depth 1
    posts {        # depth 2
      title        # depth 3
    }
  }
}

# Depth 6 query (may be blocked for public users)
query DeepQuery {
  user {              # depth 1
    posts {           # depth 2
      comments {      # depth 3
        author {      # depth 4
          posts {     # depth 5
            title     # depth 6
          }
        }
      }
    }
  }
}
```

### 3. Security Validation Plugin

**File:** `security-validation.plugin.ts`

Enforces GraphQL security best practices.

#### Features
- Operation name enforcement
- Mutation batching limits
- Alias limit enforcement
- Introspection blocking
- Query execution timeout
- Performance metrics tracking

#### Configuration

Environment variables:
```bash
GRAPHQL_REQUIRE_OPERATION_NAME=true     # Require named operations
GRAPHQL_MAX_MUTATIONS_PER_REQUEST=10    # Max mutations per batch
GRAPHQL_MAX_ALIASES=15                  # Max field aliases
GRAPHQL_QUERY_TIMEOUT_MS=30000          # Query timeout (30s)
GRAPHQL_QUERY_TIMEOUT_ADMIN_MS=60000    # Admin timeout (60s)
```

#### Security Rules

1. **Operation Names Required (Production)**
   ```graphql
   # ❌ Blocked in production
   query {
     users { id }
   }

   # ✅ Allowed
   query GetUsers {
     users { id }
   }
   ```

2. **Mutation Batching Limits**
   ```graphql
   # ✅ Allowed (3 mutations)
   mutation BatchCreate {
     user1: createUser(name: "John") { id }
     user2: createUser(name: "Jane") { id }
     user3: createUser(name: "Bob") { id }
   }

   # ❌ Blocked (11 mutations, exceeds limit of 10)
   mutation ExcessiveBatch {
     user1: createUser(...) { id }
     user2: createUser(...) { id }
     # ... 9 more ...
   }
   ```

3. **Alias Limits**
   ```graphql
   # ✅ Allowed (3 aliases)
   query MultipleUsers {
     user1: user(id: "1") { id }
     user2: user(id: "2") { id }
     user3: user(id: "3") { id }
   }

   # ❌ Blocked (16 aliases, exceeds limit of 15)
   query ExcessiveAliases {
     user1: user(id: "1") { id }
     # ... 15 more aliases ...
   }
   ```

4. **Introspection Blocking**
   ```graphql
   # ❌ Blocked in production
   query IntrospectionQuery {
     __schema {
       types { name }
     }
   }
   ```

### 4. Tenant Context Plugin

**File:** `tenant-context.plugin.ts`

Manages database connections and ensures proper cleanup.

#### Features
- Database connection lifecycle management
- Automatic connection release
- Error-safe cleanup
- Tenant isolation support

## Complexity Configuration Service

**File:** `../graphql/complexity-config.service.ts`

Centralized configuration and management for GraphQL security settings.

#### Features
- Field-level complexity costs
- Dynamic complexity limits
- Complexity tracking and analytics
- Custom complexity estimators

#### Usage

```typescript
import { ComplexityConfigService } from '@/common/graphql/complexity-config.service';

// Get complexity limit for user
const limit = complexityConfigService.getComplexityLimit(user.roles);

// Get field complexity
const cost = complexityConfigService.getFieldComplexity('Query', 'users');

// Track query statistics
await complexityConfigService.trackComplexity({
  operationName: 'GetUsers',
  complexity: 150,
  depth: 4,
  executionTimeMs: 234,
  userId: user.id,
  tenantId: user.tenantId,
  timestamp: new Date(),
});

// Get complexity statistics
const stats = await complexityConfigService.getComplexityStats(tenantId);

// Get top expensive queries
const expensive = await complexityConfigService.getTopExpensiveQueries(10);
```

## Database Schema

### Query Complexity Tracking Table

```sql
CREATE TABLE graphql_query_complexity_log (
    id UUID PRIMARY KEY,
    operation_name VARCHAR(255),
    complexity INTEGER,
    depth INTEGER,
    execution_time_ms INTEGER,
    user_id UUID,
    tenant_id UUID,
    was_blocked BOOLEAN,
    created_at TIMESTAMP
);
```

### Analytics Views

- `graphql_query_complexity_summary` - Aggregated metrics
- `graphql_top_expensive_queries` - Top 100 expensive queries

## Integration

The plugins are automatically integrated in `app.module.ts`:

```typescript
GraphQLModule.forRootAsync<ApolloDriverConfig>({
  // ... config ...
  plugins: [
    new TenantContextPlugin(),
    new QueryComplexityPlugin(),
    new QueryDepthLimiterPlugin(),
    new SecurityValidationPlugin(),
  ],
});
```

## Testing

Comprehensive tests are available in `__tests__/`:

```bash
# Run all plugin tests
npm test -- query-complexity.plugin
npm test -- query-depth-limiter.plugin
npm test -- security-validation.plugin

# Run all tests
npm test
```

## Monitoring

### Logs

All plugins log security events:

```
[QueryComplexityPlugin] Query complexity: 150/1000 [LOW] (user: user-123, operation: GetUsers)
[QueryDepthLimiterPlugin] Query depth: 4/7 [MEDIUM] (user: user-123, operation: GetUserPosts)
[SecurityValidationPlugin] Security validation passed - Fields: 25, Aliases: 3, Mutations: 0
```

### Metrics

Development mode includes execution metrics in GraphQL responses:

```json
{
  "data": { ... },
  "extensions": {
    "metrics": {
      "executionTime": "234ms",
      "fieldCount": 25,
      "aliasCount": 3
    }
  }
}
```

### Database Analytics

Query complexity logs for analysis:

```sql
-- Get average complexity by operation
SELECT
  operation_name,
  AVG(complexity) as avg_complexity,
  COUNT(*) as executions
FROM graphql_query_complexity_log
GROUP BY operation_name
ORDER BY avg_complexity DESC;

-- Get slow queries
SELECT *
FROM graphql_query_complexity_log
WHERE execution_time_ms > 1000
ORDER BY execution_time_ms DESC
LIMIT 100;
```

## Best Practices

1. **Always name operations** - Makes debugging and monitoring easier
2. **Use fragments** - Reduces complexity and improves maintainability
3. **Request only needed fields** - Reduces complexity and improves performance
4. **Avoid deep nesting** - Use pagination and separate queries instead
5. **Batch mutations carefully** - Stay under the limit of 10 per request
6. **Minimize aliases** - Use them only when necessary

## Error Handling

### Complexity Limit Exceeded

```json
{
  "errors": [
    {
      "message": "Query is too complex: 1500. Maximum allowed complexity: 1000",
      "extensions": {
        "code": "GRAPHQL_COMPLEXITY_LIMIT_EXCEEDED",
        "complexity": 1500,
        "maxComplexity": 1000,
        "hint": "Try simplifying your query by requesting fewer fields or reducing nesting depth"
      }
    }
  ]
}
```

### Depth Limit Exceeded

```json
{
  "errors": [
    {
      "message": "Query is too deep: 8. Maximum allowed depth: 7",
      "extensions": {
        "code": "GRAPHQL_DEPTH_LIMIT_EXCEEDED",
        "depth": 8,
        "maxDepth": 7,
        "hint": "Try reducing the nesting level of your query"
      }
    }
  ]
}
```

### Mutation Batching Limit

```json
{
  "errors": [
    {
      "message": "Too many mutations in single request: 11. Maximum allowed: 10",
      "extensions": {
        "code": "MUTATION_BATCHING_LIMIT_EXCEEDED",
        "mutationCount": 11,
        "maxMutations": 10,
        "hint": "Split your mutations into multiple requests"
      }
    }
  ]
}
```

## Customization

### Custom Field Complexity

Add custom field complexity costs in `complexity-config.service.ts`:

```typescript
private readonly fieldComplexityOverrides: Map<string, number> = new Map([
  ['Query.searchAll', 100],     // Expensive search
  ['Query.analytics', 80],      // Analytics computation
  ['Mutation.bulkCreate', 50],  // Bulk operations
]);
```

### Dynamic Limits

Adjust limits based on system load:

```typescript
// Reduce limits during high load
complexityConfigService.updateComplexityLimits({
  authenticated: 500,
  admin: 2000,
});

// Restore after load decreases
complexityConfigService.updateComplexityLimits({
  authenticated: 1000,
  admin: 5000,
});
```

## Security Considerations

1. **Production Hardening**
   - Operation names required
   - Introspection disabled
   - Conservative complexity limits
   - Shorter query timeouts

2. **Rate Limiting**
   - Combine with WebSocket rate limiting
   - Track per-user query patterns
   - Block abusive users

3. **Monitoring**
   - Track complexity trends
   - Alert on unusual patterns
   - Review expensive queries regularly

4. **Regular Audits**
   - Review complexity logs
   - Optimize expensive queries
   - Update complexity costs
   - Adjust limits as needed

## Related Documentation

- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [Apollo Server Security](https://www.apollographql.com/docs/apollo-server/security/)
- [Query Complexity Analysis](https://github.com/slicknode/graphql-query-complexity)
- WebSocket Security Module: `../websocket/`
- Tenant Isolation: `../../database/`

## Support

For issues or questions about GraphQL security:
1. Check logs for security warnings
2. Review complexity analytics
3. Consult this documentation
4. Contact the backend team
