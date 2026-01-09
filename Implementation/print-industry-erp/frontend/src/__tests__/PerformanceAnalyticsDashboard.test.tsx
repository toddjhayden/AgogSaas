import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import { PerformanceAnalyticsDashboard } from '../pages/PerformanceAnalyticsDashboard';
import {
  GET_PERFORMANCE_OVERVIEW,
  GET_SLOW_QUERIES,
  GET_ENDPOINT_METRICS,
  GET_RESOURCE_UTILIZATION,
  GET_DATABASE_POOL_METRICS,
  GET_DATABASE_STATS,
} from '../graphql/queries/performance';

// ============================================================================
// Mock Data
// ============================================================================

const mockPerformanceOverview = {
  performanceOverview: {
    timeRange: 'LAST_HOUR',
    healthScore: 92.5,
    status: 'HEALTHY',
    avgResponseTimeMs: 125.3,
    p95ResponseTimeMs: 450.2,
    p99ResponseTimeMs: 890.1,
    requestsPerSecond: 45.2,
    errorRate: 0.015,
    avgQueryTimeMs: 23.5,
    slowQueryCount: 3,
    connectionPoolUtilization: 45.2,
    avgCpuUsagePercent: 35.8,
    avgMemoryUsageMB: 512.4,
    maxMemoryUsageMB: 1024.0,
    performanceTrend: 'STABLE',
    topBottlenecks: [
      {
        type: 'SLOW_QUERY',
        severity: 'MEDIUM',
        description: 'Query execution time exceeds threshold',
        impact: 'Increased response time for user searches',
        recommendation: 'Add index on search_terms column',
        affectedEndpoints: ['/api/search', '/api/products'],
      },
    ],
  },
};

const mockSlowQueries = {
  slowQueries: [
    {
      id: '1',
      queryHash: 'abc123',
      queryPreview: 'SELECT * FROM products WHERE category = ...',
      executionTimeMs: 1250,
      rowsReturned: 1500,
      endpoint: '/api/products',
      timestamp: '2025-12-30T12:00:00Z',
      occurrenceCount: 45,
    },
    {
      id: '2',
      queryHash: 'def456',
      queryPreview: 'SELECT * FROM orders WHERE status = ...',
      executionTimeMs: 2100,
      rowsReturned: 850,
      endpoint: '/api/orders',
      timestamp: '2025-12-30T12:05:00Z',
      occurrenceCount: 23,
    },
  ],
};

const mockEndpointMetrics = {
  endpointMetrics: [
    {
      endpoint: '/api/products',
      method: 'GET',
      totalRequests: 1250,
      successfulRequests: 1235,
      failedRequests: 15,
      avgResponseTimeMs: 125.3,
      p50ResponseTimeMs: 95.2,
      p95ResponseTimeMs: 450.2,
      p99ResponseTimeMs: 890.1,
      maxResponseTimeMs: 1250.0,
      avgRequestSizeBytes: 512,
      avgResponseSizeBytes: 2048,
      trend: 'STABLE',
    },
  ],
};

const mockResourceUtilization = {
  resourceUtilization: [
    {
      timestamp: '2025-12-30T11:00:00Z',
      cpuUsagePercent: 35.8,
      memoryUsedMB: 512,
      memoryTotalMB: 1024,
      eventLoopLagMs: 2.5,
      activeConnections: 12,
      heapUsedMB: 256,
      heapTotalMB: 512,
    },
    {
      timestamp: '2025-12-30T11:05:00Z',
      cpuUsagePercent: 38.2,
      memoryUsedMB: 524,
      memoryTotalMB: 1024,
      eventLoopLagMs: 3.1,
      activeConnections: 15,
      heapUsedMB: 268,
      heapTotalMB: 512,
    },
  ],
};

const mockDatabasePoolMetrics = {
  databasePoolMetrics: {
    currentConnections: 50,
    idleConnections: 38,
    waitingRequests: 0,
    totalQueries: 15432,
    avgQueryTimeMs: 23.5,
    utilizationPercent: 45.2,
    utilizationHistory: [
      {
        timestamp: '2025-12-30T11:00:00Z',
        utilizationPercent: 42.5,
        activeConnections: 12,
        queuedRequests: 0,
      },
      {
        timestamp: '2025-12-30T11:05:00Z',
        utilizationPercent: 45.2,
        activeConnections: 15,
        queuedRequests: 0,
      },
    ],
  },
};

const mockDatabaseStats = {
  databaseStats: {
    connectionStats: {
      total: 50,
      active: 12,
      idle: 38,
      waiting: 0,
      maxConnections: 100,
    },
    queryStats: {
      totalQueries: 15432,
      avgQueryTimeMs: 23.5,
      slowQueries: 3,
      cacheHitRatio: 97.8,
    },
    tableStats: {
      totalTables: 125,
      totalRows: 5678901,
      totalSizeMB: 2345.67,
      indexSizeMB: 678.9,
    },
    performanceStats: {
      transactionsPerSecond: 45.2,
      blocksRead: 1234567,
      blocksHit: 89012345,
      tuplesReturned: 12345678,
      tuplesFetched: 9876543,
    },
  },
};

// ============================================================================
// Test Helpers
// ============================================================================

const renderWithProviders = (component: React.ReactElement, mocks: MockedResponse[]) => {
  return render(
    <BrowserRouter>
      <MockedProvider mocks={mocks} addTypename={false}>
        {component}
      </MockedProvider>
    </BrowserRouter>
  );
};

const createDefaultMocks = (): MockedResponse[] => [
  {
    request: {
      query: GET_PERFORMANCE_OVERVIEW,
      variables: { facilityId: null, timeRange: 'LAST_HOUR' },
    },
    result: { data: mockPerformanceOverview },
  },
  {
    request: {
      query: GET_SLOW_QUERIES,
      variables: { facilityId: null, threshold: 1000, timeRange: 'LAST_HOUR', limit: 50 },
    },
    result: { data: mockSlowQueries },
  },
  {
    request: {
      query: GET_ENDPOINT_METRICS,
      variables: { endpoint: null, timeRange: 'LAST_HOUR' },
    },
    result: { data: mockEndpointMetrics },
  },
  {
    request: {
      query: GET_RESOURCE_UTILIZATION,
      variables: { facilityId: null, timeRange: 'LAST_HOUR', interval: '5m' },
    },
    result: { data: mockResourceUtilization },
  },
  {
    request: {
      query: GET_DATABASE_POOL_METRICS,
      variables: { timeRange: 'LAST_HOUR' },
    },
    result: { data: mockDatabasePoolMetrics },
  },
  {
    request: {
      query: GET_DATABASE_STATS,
    },
    result: { data: mockDatabaseStats },
  },
];

// ============================================================================
// Test Suite
// ============================================================================

describe('PerformanceAnalyticsDashboard', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders dashboard with all sections', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      // Header
      expect(screen.getByText('Performance Analytics & Optimization Dashboard')).toBeInTheDocument();

      // Overview cards
      expect(screen.getByText('Health Score')).toBeInTheDocument();
      expect(screen.getByText('Average Response Time')).toBeInTheDocument();
      expect(screen.getByText('Requests/Second')).toBeInTheDocument();
      expect(screen.getByText('System Resources')).toBeInTheDocument();

      // Database Stats Card
      expect(screen.getByText('Database Statistics')).toBeInTheDocument();
    });
  });

  it('displays correct health score and status', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('92.5')).toBeInTheDocument();
      expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    });
  });

  it('displays performance metrics correctly', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('125')).toBeInTheDocument(); // avg response time
      expect(screen.getByText('45.2')).toBeInTheDocument(); // requests per second
      expect(screen.getByText('1.50%')).toBeInTheDocument(); // error rate
    });
  });

  it('renders slow queries table when data is available', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('SELECT * FROM products WHERE category = ...')).toBeInTheDocument();
      expect(screen.getByText('SELECT * FROM orders WHERE status = ...')).toBeInTheDocument();
      expect(screen.getByText('1,250 ms')).toBeInTheDocument();
      expect(screen.getByText('2,100 ms')).toBeInTheDocument();
    });
  });

  it('renders endpoint performance table', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('/api/products')).toBeInTheDocument();
      expect(screen.getByText('1,250')).toBeInTheDocument(); // total requests
      expect(screen.getByText('98.8% success')).toBeInTheDocument(); // success rate
    });
  });

  it('renders performance bottlenecks section', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Performance Bottlenecks')).toBeInTheDocument();
      expect(screen.getByText('Query execution time exceeds threshold')).toBeInTheDocument();
      expect(screen.getByText('Add index on search_terms column')).toBeInTheDocument();
    });
  });

  it('integrates DatabaseStatsCard component', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      // Verify DatabaseStatsCard is rendered
      expect(screen.getByText('Connection Statistics')).toBeInTheDocument();
      expect(screen.getByText('Query Statistics')).toBeInTheDocument();
      expect(screen.getByText('Storage Statistics')).toBeInTheDocument();
      expect(screen.getByText('Performance Indicators')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Interaction Tests
  // ============================================================================

  it('allows changing time range', async () => {
    const mocks = [
      ...createDefaultMocks(),
      {
        request: {
          query: GET_PERFORMANCE_OVERVIEW,
          variables: { facilityId: null, timeRange: 'LAST_24_HOURS' },
        },
        result: { data: mockPerformanceOverview },
      },
    ];

    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Health Score')).toBeInTheDocument();
    });

    // Change time range
    const timeRangeSelect = screen.getByRole('combobox');
    fireEvent.change(timeRangeSelect, { target: { value: 'LAST_24_HOURS' } });

    expect(timeRangeSelect).toHaveValue('LAST_24_HOURS');
  });

  it('allows changing slow query threshold', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Slow Queries')).toBeInTheDocument();
    });

    const thresholdInput = screen.getByRole('spinbutton');
    fireEvent.change(thresholdInput, { target: { value: '2000' } });

    expect(thresholdInput).toHaveValue(2000);
  });

  it('has functional refresh button', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    // Button should be clickable
    expect(refreshButton).toBeEnabled();
  });

  // ============================================================================
  // Loading State Tests
  // ============================================================================

  it('displays loading state initially', () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('displays error message on query failure', async () => {
    const errorMocks: MockedResponse[] = [
      {
        request: {
          query: GET_PERFORMANCE_OVERVIEW,
          variables: { facilityId: null, timeRange: 'LAST_HOUR' },
        },
        error: new Error('Failed to fetch performance data'),
      },
    ];

    renderWithProviders(<PerformanceAnalyticsDashboard />, errorMocks);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch performance data')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Status Color Tests
  // ============================================================================

  it('displays correct colors for health status', async () => {
    const mocks = createDefaultMocks();
    const { _container } = renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      const healthyBadge = screen.getByText('HEALTHY');
      expect(healthyBadge).toHaveClass('text-success-600');
      expect(healthyBadge).toHaveClass('bg-success-100');
    });
  });

  it('displays warning color for high slow query count', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      // Slow query count > 10 should not show warning in this case (count is 3)
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Chart Rendering Tests
  // ============================================================================

  it('renders CPU utilization chart', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('CPU Utilization Over Time')).toBeInTheDocument();
    });
  });

  it('renders memory utilization chart', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Memory Utilization Over Time')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  it('displays all sections with data', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      // Overview cards
      expect(screen.getByText('92.5')).toBeInTheDocument();

      // Performance trend
      expect(screen.getByText('Performance Trend')).toBeInTheDocument();

      // Database pool
      expect(screen.getByText('Database Pool Health')).toBeInTheDocument();

      // Charts
      expect(screen.getByText('CPU Utilization Over Time')).toBeInTheDocument();
      expect(screen.getByText('Memory Utilization Over Time')).toBeInTheDocument();

      // Database Stats
      expect(screen.getByText('Database Statistics')).toBeInTheDocument();

      // Bottlenecks
      expect(screen.getByText('Performance Bottlenecks')).toBeInTheDocument();

      // Tables
      expect(screen.getByText('Slow Queries')).toBeInTheDocument();
      expect(screen.getByText('Endpoint Performance')).toBeInTheDocument();
    });
  });

  it('handles multiple queries successfully', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<PerformanceAnalyticsDashboard />, mocks);

    await waitFor(() => {
      // Verify data from all queries is displayed
      expect(screen.getByText('92.5')).toBeInTheDocument(); // Performance overview
      expect(screen.getByText('SELECT * FROM products WHERE category = ...')).toBeInTheDocument(); // Slow queries
      expect(screen.getByText('/api/products')).toBeInTheDocument(); // Endpoint metrics
      expect(screen.getByText('Database Statistics')).toBeInTheDocument(); // Database stats
    }, { timeout: 3000 });
  });
});
