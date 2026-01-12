# FedEx Carrier Integration & Multi-Carrier Network - Frontend Implementation

**REQ-1767925582663-ieqg0**

## Overview

This document describes the frontend implementation for the FedEx Carrier Integration & Multi-Carrier Network feature. The implementation provides a comprehensive user interface for managing shipping carriers, comparing rates, and creating shipments.

## Components Implemented

### 1. Rate Shopping Modal (`/components/shipping/RateShoppingModal.tsx`)

**Purpose**: Allows users to compare shipping rates across multiple carriers (FedEx, UPS, USPS, DHL, etc.)

**Features**:
- Real-time rate comparison from multiple carriers
- Sort by lowest cost or fastest delivery
- Visual carrier badges with color coding
- Detailed rate breakdown (base rate, fuel surcharge, insurance, residential fees)
- Guaranteed delivery indicators
- Estimated delivery dates
- Package weight summary
- Interactive rate selection

**Key UI Elements**:
- Shipment summary (origin, destination, packages)
- Sort controls (cost vs speed)
- Rate cards with carrier branding
- Surcharge breakdown
- Selected rate confirmation

**GraphQL Integration**:
```typescript
import { GET_RATE_QUOTES } from '../../graphql/queries/shipping';
```

### 2. FedEx Setup Wizard (`/components/shipping/FedExSetupWizard.tsx`)

**Purpose**: Guided setup process for configuring FedEx API integration

**Features**:
- 4-step wizard process
- Step 1: Basic Information (account number, environment)
- Step 2: API Credentials (API key, secret key)
- Step 3: Shipping Preferences (label format)
- Step 4: Review & Test Connection
- Credential security notice (AES-256-GCM encryption)
- Connection testing capability

**Key UI Elements**:
- Progress indicator
- Step navigation (back/next)
- Form validation
- Secure password fields
- Environment selection (TEST/PRODUCTION)
- Label format selection (PDF/PNG/ZPL)

**GraphQL Integration**:
```typescript
import { CREATE_CARRIER_INTEGRATION, UPDATE_CARRIER_INTEGRATION } from '../../graphql/mutations/shipping';
import { TEST_CARRIER_CONNECTION } from '../../graphql/queries/shipping';
```

### 3. Carrier Management Page (`/pages/CarrierIntegrationsPage.tsx`)

**Purpose**: Central management interface for all carrier integrations

**Features**:
- Data table with carrier information
- Carrier type badges (PARCEL, LTL, FTL, COURIER, 3PL, FREIGHT_FORWARDER)
- Credential status indicators
- Feature support indicators (tracking, rate quotes, label generation)
- Active/inactive status toggle
- Carrier detail modal
- API configuration display

**Key UI Elements**:
- Breadcrumb navigation
- Searchable/sortable data table
- Status indicators (active/inactive)
- Feature checkboxes
- Modal for carrier details
- Activate/deactivate controls

**GraphQL Integration**:
```typescript
import { GET_CARRIER_INTEGRATIONS } from '../graphql/queries/shipping';
import { UPDATE_CARRIER_INTEGRATION } from '../graphql/mutations/shipping';
```

### 4. Create Shipment Page (`/pages/CreateShipmentPage.tsx`)

**Purpose**: Comprehensive shipment creation workflow

**Features**:
- Ship From address display (warehouse)
- Ship To address entry and validation
- Multi-package support (add/remove packages)
- Package dimensions and weight entry
- Address validation with FedEx/carrier APIs
- Rate shopping integration
- Shipment options (residential, Saturday delivery)
- Declared value entry
- Shipment summary sidebar
- Selected rate display

**Key UI Elements**:
- 3-column responsive layout
- Ship From/Ship To address cards
- Package management section
- Shipment options form
- Rate selection sidebar
- Summary panel
- Create shipment button

**GraphQL Integration**:
```typescript
import { CREATE_SHIPMENT } from '../graphql/mutations/shipping';
import { VALIDATE_ADDRESS } from '../graphql/queries/shipping';
import { RateShoppingModal } from '../components/shipping/RateShoppingModal';
```

## GraphQL Queries

All queries are defined in `/graphql/queries/shipping.ts`:

1. **GET_SHIPMENTS** - List shipments with filters
2. **GET_SHIPMENT** - Get shipment details with tracking
3. **GET_CARRIER_INTEGRATIONS** - List all carrier integrations
4. **GET_CARRIER_INTEGRATION** - Get single carrier details
5. **GET_TRACKING_EVENTS** - Get tracking history
6. **TEST_CARRIER_CONNECTION** - Test carrier API connection
7. **GET_RATE_QUOTES** - Get multi-carrier rate quotes
8. **VALIDATE_ADDRESS** - Validate shipping address
9. **TRACK_SHIPMENT** - Track shipment by tracking number

## GraphQL Mutations

All mutations are defined in `/graphql/mutations/shipping.ts`:

1. **CREATE_SHIPMENT** - Create new shipment
2. **MANIFEST_SHIPMENT** - Generate shipping label
3. **SHIP_SHIPMENT** - Mark shipment as shipped
4. **UPDATE_SHIPMENT_STATUS** - Update shipment status
5. **CREATE_CARRIER_INTEGRATION** - Add new carrier
6. **UPDATE_CARRIER_INTEGRATION** - Update carrier settings
7. **DELETE_CARRIER_INTEGRATION** - Remove carrier
8. **VOID_SHIPMENT** - Cancel shipment label
9. **CREATE_MANIFEST** - Create end-of-day manifest
10. **REFRESH_TRACKING** - Update tracking information

## Internationalization (i18n)

All translations are stored in `/i18n/locales/shipping-translations-addition.json`:

### Key Translation Categories:

1. **Carrier Management** (`shipping.carriers.*`)
   - Carrier types
   - Status labels
   - Feature names
   - Configuration fields

2. **Rate Shopping** (`shipping.rateShop.*`)
   - Modal title and description
   - Sort options (cost, speed)
   - Rate card labels
   - Surcharge descriptions

3. **FedEx Setup** (`shipping.fedex.*`)
   - Wizard steps
   - Form labels
   - Help text
   - Feature descriptions

4. **Shipment Creation** (`shipping.*`)
   - Address fields
   - Package information
   - Options and preferences
   - Validation messages

## Routing Integration

The following routes should be added to the application router:

```typescript
// Carrier Management
/wms/carrier-integrations -> CarrierIntegrationsPage

// Shipment Management
/wms/shipments -> ShipmentsPage
/wms/shipments/create -> CreateShipmentPage
/wms/shipments/:id -> ShipmentDetailPage
```

## Navigation Integration

Add to WMS navigation menu:

```typescript
{
  label: t('nav.carrierIntegrations'),
  path: '/wms/carrier-integrations',
  icon: Truck
},
{
  label: t('nav.shipments'),
  path: '/wms/shipments',
  icon: Package
}
```

## Styling & Design System

All components use the established design system:

- **Colors**: Primary palette (purple/primary), semantic colors (green success, red error)
- **Icons**: Lucide React icons
- **Typography**: Tailwind CSS utility classes
- **Layout**: Responsive grid system
- **Components**: Reusable components from `/components/common`

## Testing Considerations

### Unit Tests
- Component rendering
- Form validation
- Rate calculation display
- Status badge rendering

### Integration Tests
- GraphQL query mocking
- Mutation handling
- Error states
- Loading states

### E2E Tests
- Complete shipment creation flow
- Carrier setup wizard
- Rate shopping workflow
- Address validation

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ JavaScript features
- CSS Grid and Flexbox

## Performance Optimizations

1. **Lazy Query Loading**: Rate quotes only fetched when modal opens
2. **Optimistic Updates**: Immediate UI feedback for carrier status changes
3. **Debounced Address Validation**: Prevent excessive API calls
4. **Pagination**: Large carrier lists use DataTable pagination
5. **Code Splitting**: Route-based code splitting

## Security Considerations

1. **Credential Display**: API keys never displayed in full
2. **Encryption Notice**: Users informed of AES-256-GCM encryption
3. **Validation**: Client-side validation for all inputs
4. **HTTPS Only**: Production environment uses secure connections
5. **Token Handling**: GraphQL client handles authentication

## Future Enhancements

1. **Carrier Logos**: Display actual carrier logos instead of badges
2. **Rate History**: Show historical rate trends
3. **Batch Shipment**: Create multiple shipments at once
4. **Label Printing**: Direct label print from browser
5. **Tracking Notifications**: Real-time tracking event notifications
6. **International Shipping**: Enhanced customs documentation
7. **Returns Management**: Reverse logistics workflow

## Dependencies

- `@apollo/client`: GraphQL client
- `react-i18next`: Internationalization
- `lucide-react`: Icon library
- `@tanstack/react-table`: Data table component
- `react-router-dom`: Routing

## Related Backend Components

- **Carrier Services**: `/backend/src/services/carriers/`
- **FedEx Integration**: `/backend/src/services/carriers/fedex/`
- **Multi-Carrier Router**: `/backend/src/services/carriers/multi-carrier-router.service.ts`
- **Rate Shopping Service**: `/backend/src/services/carriers/rate-shopping.service.ts`

## Deployment Notes

1. **Environment Variables**: Configure carrier API endpoints
2. **Feature Flags**: Enable/disable specific carriers
3. **Rate Limits**: Monitor carrier API usage
4. **Error Monitoring**: Track GraphQL errors
5. **Analytics**: Track rate shopping usage patterns

## Support & Documentation

For backend integration details, see:
- Research deliverable: `nats://agog.deliverables.cynthia.research.REQ-1767925582663-ieqg0`
- Backend deliverable: `nats://agog.deliverables.roy.backend.REQ-1767925582663-ieqg0`

---

**Implementation Date**: 2026-01-11
**Frontend Agent**: Jen
**Status**: ✅ Complete
