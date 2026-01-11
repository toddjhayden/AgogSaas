# Carrier Integration System

**REQ-1767925582663-ieqg0: FedEx Carrier Integration & Multi-Carrier Network**

Complete multi-carrier shipping integration supporting FedEx, UPS, USPS, DHL, and custom carriers.

## Architecture Overview

### Components

1. **Carrier Client Interface** (`interfaces/carrier-client.interface.ts`)
   - Unified API for all carriers
   - Strategy pattern implementation
   - Supports: address validation, rate shopping, label generation, tracking

2. **Carrier Integration Service** (`services/carrier-integration.service.ts`)
   - Manages carrier configurations in database
   - Secure credential storage with encryption
   - Multi-tenant isolation
   - Connection health monitoring

3. **Shipping Service** (`services/shipping.service.ts`)
   - High-level orchestration layer
   - Multi-carrier rate shopping
   - Shipment lifecycle management
   - Tracking updates

4. **FedEx API Client** (`services/carriers/fedex-api.client.ts`)
   - Production FedEx Ship API v1 integration
   - OAuth2 authentication with auto-refresh
   - Rate quotes, label generation, tracking
   - End-of-day manifest (Close API)

5. **Rate Limiter** (`services/carrier-rate-limiter.service.ts`)
   - Token bucket algorithm
   - Per-carrier rate limits (FedEx: 10/sec, UPS: 5/sec)
   - Priority queue for rush shipments
   - Real-time quota monitoring

6. **Circuit Breaker** (`services/carrier-circuit-breaker.service.ts`)
   - Automatic failover on carrier API failures
   - Health check monitoring
   - Exponential backoff

7. **GraphQL API** (`graphql/resolvers/shipping.resolver.ts`)
   - Carrier CRUD operations
   - Rate shopping
   - Shipment creation and manifesting
   - Tracking queries

8. **Webhook Controller** (`controllers/carrier-webhook.controller.ts`)
   - Real-time tracking updates from carriers
   - Signature validation
   - Idempotency handling

## Database Schema

### carrier_integrations
```sql
- id (UUID)
- tenant_id (UUID) - Multi-tenant isolation
- facility_id (UUID) - Per-facility configuration
- carrier_code (VARCHAR) - FEDEX, UPS, USPS, etc.
- carrier_name (VARCHAR)
- carrier_account_number (VARCHAR)
- api_endpoint (VARCHAR)
- api_username (VARCHAR)
- api_password_encrypted (TEXT) - AES-256 encrypted
- api_key_encrypted (TEXT)
- oauth_token_encrypted (TEXT)
- available_services (JSONB) - Service type mappings
- default_service_code (VARCHAR)
- label_format (VARCHAR) - PDF, PNG, ZPL
- is_active (BOOLEAN)
- connection_status (VARCHAR) - CONNECTED, DISCONNECTED, ERROR
- last_connection_test (TIMESTAMPTZ)
```

### shipments
```sql
- id (UUID)
- tenant_id (UUID)
- facility_id (UUID)
- shipment_number (VARCHAR) - Generated: SHP20260110001
- sales_order_id (UUID)
- carrier_id (UUID) -> carrier_integrations
- carrier_name (VARCHAR)
- service_level (VARCHAR) - GROUND, EXPRESS, etc.
- tracking_number (VARCHAR)
- ship_to_* (ADDRESS FIELDS)
- number_of_packages (INTEGER)
- total_weight (DECIMAL)
- freight, insurance, total_cost (DECIMAL)
- status (VARCHAR) - DRAFT, MANIFESTED, SHIPPED, DELIVERED
- label_url (VARCHAR)
- created_at, updated_at
```

### tracking_events
```sql
- id (UUID)
- shipment_id (UUID)
- event_date (TIMESTAMPTZ)
- event_type (VARCHAR) - PICKED_UP, IN_TRANSIT, DELIVERED
- event_description (TEXT)
- location_city, location_state, location_country (VARCHAR)
- carrier_event_code (VARCHAR)
- exception_flag (BOOLEAN)
```

## GraphQL API

### Queries

```graphql
# Get all carrier integrations for a tenant
carrierIntegrations(tenantId: ID!, facilityId: ID): [CarrierIntegration!]!

# Get rate quotes from multiple carriers
getRateQuotes(input: RateShopInput!): [RateQuote!]!

# Validate shipping address
validateAddress(input: ValidateAddressInput!, carrierCode: CarrierCode): AddressValidationResult!

# Get shipment details with tracking
shipment(id: ID!, tenantId: ID!): Shipment

# Track shipment by tracking number
trackShipment(trackingNumber: String!, carrierCode: CarrierCode!): [TrackingEvent!]!
```

### Mutations

```graphql
# Create carrier integration
createCarrierIntegration(input: CreateCarrierIntegrationInput!): CarrierIntegration!

# Create shipment (DRAFT status)
createShipment(input: CreateShipmentInput!): Shipment!

# Manifest shipment (generates label and tracking)
manifestShipment(id: ID!): Shipment!

# Void/cancel shipment
voidShipment(id: ID!): Boolean!

# Create end-of-day manifest
createManifest(shipmentIds: [ID!]!, carrierIntegrationId: ID!): ManifestConfirmation!

# Refresh tracking from carrier API
refreshTracking(shipmentId: ID!): [TrackingEvent!]!
```

## FedEx Integration

### Authentication
- OAuth2 client credentials flow
- Token caching with auto-refresh (5 min buffer)
- Test environment: `https://apis-sandbox.fedex.com`
- Production environment: `https://apis.fedex.com`

### Required Credentials
```typescript
{
  apiKey: string;        // FedEx API Key
  secretKey: string;     // FedEx Secret Key
  accountNumber: string; // FedEx Account Number
  meterNumber?: string;  // Optional meter number
}
```

### Supported Operations
1. **Address Validation** - Standardize and validate addresses
2. **Rate Quotes** - Get shipping rates for all service types
3. **Ship** - Create shipment and generate label
4. **Track** - Get real-time tracking updates
5. **Void** - Cancel shipment before pickup
6. **Close** - Create end-of-day manifest for Ground shipments

### Service Types
- `FEDEX_GROUND` - Ground delivery (5 business days)
- `FEDEX_2DAY` - 2-day delivery
- `FEDEX_EXPRESS_SAVER` - 3-day delivery
- `FEDEX_STANDARD_OVERNIGHT` - Next day by 3pm
- `FEDEX_PRIORITY_OVERNIGHT` - Next day by 10:30am
- `FEDEX_FIRST_OVERNIGHT` - Next day by 8am
- `FEDEX_INTERNATIONAL_ECONOMY` - International 4-5 days
- `FEDEX_INTERNATIONAL_PRIORITY` - International 1-3 days

## Usage Examples

### 1. Configure Carrier

```graphql
mutation {
  createCarrierIntegration(input: {
    facilityId: "facility-123"
    carrierCode: FEDEX
    carrierName: "FedEx"
    carrierType: PARCEL
    accountNumber: "123456789"
    apiKey: "your-api-key"
    secretKey: "your-secret-key"
    labelFormat: PDF
    isActive: true
  }) {
    id
    carrierName
    isActive
  }
}
```

### 2. Rate Shopping

```graphql
query {
  getRateQuotes(input: {
    facilityId: "facility-123"
    shipToAddressLine1: "123 Main St"
    shipToCity: "New York"
    shipToState: "NY"
    shipToPostalCode: "10001"
    shipToCountry: "US"
    packages: [{
      weight: 5.0
      weightUnit: "LB"
    }]
  }) {
    carrierName
    serviceName
    totalCost
    transitDays
    guaranteedDelivery
  }
}
```

### 3. Create and Manifest Shipment

```graphql
mutation {
  createShipment(input: {
    facilityId: "facility-123"
    carrierIntegrationId: "carrier-123"
    serviceLevel: "FEDEX_GROUND"
    customerId: "customer-456"
    shipToName: "John Doe"
    shipToAddressLine1: "123 Main St"
    shipToCity: "New York"
    shipToState: "NY"
    shipToPostalCode: "10001"
    shipToCountry: "US"
    packages: [{
      sequenceNumber: 1
      weight: 5.0
      weightUnit: "LB"
    }]
    lines: [{
      materialId: "material-789"
      quantityShipped: 10
      unitOfMeasure: "EA"
    }]
  }) {
    id
    shipmentNumber
    status
  }
}

mutation {
  manifestShipment(id: "shipment-123") {
    trackingNumber
    labelUrl
    totalCost
  }
}
```

### 4. Track Shipment

```graphql
mutation {
  refreshTracking(shipmentId: "shipment-123") {
    eventDate
    eventType
    eventDescription
    city
    state
  }
}
```

## Rate Limits

| Carrier | Requests/Second | Burst Capacity |
|---------|----------------|----------------|
| FedEx   | 10             | 20             |
| UPS     | 5              | 10             |
| USPS    | 1              | 2              |
| DHL     | 5              | 10             |

Rate limiter uses Token Bucket algorithm with priority queue for rush shipments.

## Error Handling

### Circuit Breaker States
- **CLOSED** - Normal operation
- **OPEN** - Carrier API failing, requests blocked
- **HALF_OPEN** - Testing if carrier recovered

### Failure Thresholds
- Max failures: 5 within 60 seconds
- Open duration: 30 seconds
- Recovery test: 1 request

### Error Mapping
- `CARRIER_UNAVAILABLE` - API down or timeout
- `INVALID_ADDRESS` - Address validation failed
- `SERVICE_NOT_AVAILABLE` - Service type not supported
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `AUTHENTICATION_FAILED` - Invalid credentials
- `SHIPMENT_NOT_FOUND` - Tracking number invalid

## Security

### Credential Encryption
- AES-256-GCM encryption
- Unique encryption key per tenant
- Credentials decrypted only when making API calls
- Never logged or exposed in responses

### Webhook Security
- HMAC-SHA256 signature validation
- IP whitelist for carrier webhook sources
- Idempotency keys to prevent duplicate processing

### Multi-Tenant Isolation
- All queries filtered by `tenant_id`
- Row-level security policies
- Separate encryption keys per tenant

## Testing

### Mock Mode
FedExClientService includes mock implementation for testing without API credentials.

### Test Credentials
FedEx provides test accounts for sandbox environment:
- Endpoint: `https://apis-sandbox.fedex.com`
- Use test API keys (no production charges)

## Production Deployment

### Environment Variables
```bash
# FedEx Production
FEDEX_API_KEY=your-production-api-key
FEDEX_SECRET_KEY=your-production-secret-key
FEDEX_ACCOUNT_NUMBER=123456789
FEDEX_ENVIRONMENT=PRODUCTION

# Webhook Security
FEDEX_WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_IP_WHITELIST=1.2.3.4,5.6.7.8

# Encryption
CARRIER_ENCRYPTION_KEY=your-32-char-encryption-key
```

### Monitoring
- Track rate limit utilization per carrier
- Monitor circuit breaker state changes
- Alert on connection test failures
- Track webhook processing errors

## Future Enhancements

1. **Additional Carriers**
   - UPS API integration
   - USPS API integration
   - DHL API integration
   - Regional carriers

2. **Advanced Features**
   - Customs documentation for international shipments
   - Hazmat/dangerous goods support
   - Freight/LTL carrier integrations
   - Carrier pickup scheduling
   - Address autocomplete

3. **Performance**
   - Batch rate shopping (parallel requests)
   - Label generation queuing for high volume
   - Webhook event deduplication with Redis

4. **Analytics**
   - Carrier performance dashboards
   - Cost optimization recommendations
   - Transit time analysis
   - Exception trend reporting

## Support

For issues or questions:
1. Check FedEx Developer Portal: https://developer.fedex.com
2. Review API documentation: https://developer.fedex.com/api/en-us/catalog/ship/docs.html
3. Contact carrier technical support for API issues
