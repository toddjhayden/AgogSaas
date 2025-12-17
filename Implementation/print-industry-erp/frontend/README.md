# AgogSaaS ERP Frontend

Production-ready React dashboard and UI components for the complete Print Industry ERP system.

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Apollo Client** - GraphQL client for API communication
- **Recharts** - Beautiful charts and visualizations
- **React Router** - Client-side routing
- **i18next** - Internationalization (English + Mandarin)
- **Zustand** - Lightweight state management
- **TanStack Table** - Advanced data tables
- **Lucide React** - Beautiful icon library
- **NATS.ws** - WebSocket integration for real-time updates

## Features

### 7 Complete Dashboards

1. **Executive Dashboard** (`/dashboard`)
   - Revenue trends (last 30 days)
   - Top 10 KPIs with real-time values
   - Marketplace activity overview
   - Multi-facility status map
   - Real-time alerts panel

2. **Operations Dashboard** (`/operations`)
   - Production runs (active, scheduled, completed)
   - Work center status with OEE metrics
   - OEE breakdown by press
   - Material consumption tracking
   - Changeover time monitoring

3. **WMS Dashboard** (`/wms`)
   - Inventory levels by location
   - Wave processing status
   - Pick accuracy rates
   - Shipment tracking
   - 3PL performance metrics

4. **Finance Dashboard** (`/finance`)
   - P&L summary with multi-currency support
   - AR/AP aging reports
   - Cash flow forecasting
   - Multi-entity consolidation

5. **Quality Dashboard** (`/quality`)
   - Defect rates by product
   - Customer rejection trends
   - Inspection results
   - NCR (Non-Conformance Reports) tracking
   - Vendor quality scorecards

6. **Marketplace Dashboard** (`/marketplace`)
   - Job postings management
   - Bid tracking
   - Partner network directory
   - Marketplace analytics
   - White-label billing setup

7. **KPI Explorer** (`/kpis`) - **THE WOW FACTOR**
   - Browse all 119 KPIs by category
   - Real-time KPI values with trend indicators
   - Sparkline charts for each KPI
   - Favorite KPIs functionality
   - Full bilingual support (English ↔ Mandarin)
   - Search and filter capabilities

### 15+ Reusable Components

- **KPICard** - Beautiful KPI display with sparklines, trends, and targets
- **DataTable** - Advanced table with sorting, filtering, pagination, export
- **Chart** - Wrapper for line, bar, and pie charts
- **FacilitySelector** - Multi-facility switcher
- **LanguageSwitcher** - English ↔ Mandarin toggle
- **AlertPanel** - Real-time alerts with severity levels
- **Header** - Top navigation with user menu
- **Sidebar** - Main navigation sidebar
- **Breadcrumb** - Navigation breadcrumbs
- **LoadingSpinner** - Loading states
- **ErrorBoundary** - Error handling

### Key Features

- **Bilingual Support** - All UI text and 119 KPIs available in English and Mandarin Chinese
- **Real-Time Updates** - WebSocket integration via NATS for live data
- **Responsive Design** - Mobile-first approach, optimized for all screen sizes
- **Accessibility** - ARIA labels, keyboard navigation, screen reader support
- **Performance** - Code splitting, memoization, virtual scrolling
- **Type Safety** - Full TypeScript coverage
- **State Management** - Zustand for user preferences, favorites, and layouts

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable components
│   │   │   ├── AlertPanel.tsx
│   │   │   ├── Chart.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── FacilitySelector.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── layout/          # Layout components
│   │       ├── Breadcrumb.tsx
│   │       ├── Header.tsx
│   │       ├── MainLayout.tsx
│   │       └── Sidebar.tsx
│   ├── graphql/
│   │   ├── queries/         # GraphQL queries
│   │   │   ├── finance.ts
│   │   │   ├── kpis.ts
│   │   │   ├── marketplace.ts
│   │   │   ├── operations.ts
│   │   │   ├── quality.ts
│   │   │   └── wms.ts
│   │   └── client.ts        # Apollo Client setup
│   ├── i18n/
│   │   ├── locales/
│   │   │   ├── en-US.json   # English translations
│   │   │   └── zh-CN.json   # Mandarin translations
│   │   └── config.ts        # i18next configuration
│   ├── pages/               # Dashboard pages
│   │   ├── ExecutiveDashboard.tsx
│   │   ├── FinanceDashboard.tsx
│   │   ├── KPIExplorer.tsx
│   │   ├── MarketplaceDashboard.tsx
│   │   ├── OperationsDashboard.tsx
│   │   ├── QualityDashboard.tsx
│   │   └── WMSDashboard.tsx
│   ├── store/
│   │   └── appStore.ts      # Zustand state management
│   ├── websocket/
│   │   └── natsClient.ts    # NATS WebSocket client
│   ├── __tests__/           # Component tests
│   │   └── KPICard.test.tsx
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles with Tailwind
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
├── vite.config.ts           # Vite configuration
└── package.json             # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run linter
npm run lint
```

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:4000/graphql
VITE_NATS_WS_URL=ws://localhost:4222
```

## GraphQL Integration

All dashboards are designed to integrate with the backend GraphQL API. Query files are organized by module:

- `graphql/queries/kpis.ts` - KPI queries (GET_ALL_KPIS, GET_TOP_KPIS, etc.)
- `graphql/queries/operations.ts` - Production and operations queries
- `graphql/queries/wms.ts` - Warehouse management queries
- `graphql/queries/finance.ts` - Financial queries
- `graphql/queries/quality.ts` - Quality management queries
- `graphql/queries/marketplace.ts` - Marketplace queries

## Real-Time Updates

The application uses NATS WebSocket for real-time updates:

```typescript
// Subscribe to KPI updates
subscribeToKPIUpdates((data) => {
  console.log('KPI updated:', data);
});

// Subscribe to production events
subscribeToProductionEvents((data) => {
  console.log('Production event:', data);
});

// Subscribe to alerts
subscribeToAlerts((data) => {
  console.log('New alert:', data);
});
```

## Internationalization

Switch between English and Mandarin using the language switcher in the header. All translations are stored in:

- `src/i18n/locales/en-US.json` - English
- `src/i18n/locales/zh-CN.json` - Mandarin

## State Management

User preferences, KPI favorites, and dashboard layouts are persisted using Zustand:

```typescript
const { preferences, kpiFavorites, addKPIFavorite, setLanguage } = useAppStore();
```

## Component Usage Examples

### KPICard

```tsx
<KPICard
  kpi={{
    id: '1',
    name: 'Overall Equipment Effectiveness',
    currentValue: 78.2,
    targetValue: 85,
    unit: '%',
    trend: 'up',
    trendPercent: 1.8,
    sparklineData: [74, 75, 76, 77, 78.2],
    formula: 'Availability × Performance × Quality',
  }}
  size="md"
  onClick={() => console.log('View details')}
/>
```

### DataTable

```tsx
<DataTable
  data={productionRuns}
  columns={columns}
  searchable={true}
  exportable={true}
  pageSize={10}
/>
```

### Chart

```tsx
<Chart
  type="line"
  data={revenueData}
  xKey="date"
  yKey="revenue"
  title="Revenue Trends"
  height={300}
/>
```

## Performance Optimizations

- Code splitting with React.lazy()
- Memoization with React.memo and useMemo
- Virtual scrolling for large datasets
- Debounced search inputs
- Optimized bundle size

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Focus indicators

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Production Deployment

```bash
# Build for production
npm run build

# Output will be in the `dist` directory
```

The production build includes:
- Minified and optimized bundles
- Code splitting for better performance
- Source maps for debugging

## Contributing

Follow React best practices:
- Use functional components and hooks
- TypeScript strict mode
- TailwindCSS for styling
- Meaningful component and variable names
- Write tests for new components

## License

Proprietary - AgogSaaS

## Support

For questions or issues, contact the development team.
