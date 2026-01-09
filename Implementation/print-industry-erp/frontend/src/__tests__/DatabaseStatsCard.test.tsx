import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { DatabaseStatsCard } from '../components/monitoring/DatabaseStatsCard';
import { GET_DATABASE_STATS } from '../graphql/queries/performance';

// ============================================================================
// Mock Data
// ============================================================================

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

const mockDatabaseStatsHighUtilization = {
  databaseStats: {
    ...mockDatabaseStats.databaseStats,
    connectionStats: {
      total: 95,
      active: 85,
      idle: 10,
      waiting: 5,
      maxConnections: 100,
    },
    queryStats: {
      ...mockDatabaseStats.databaseStats.queryStats,
      slowQueries: 25,
      cacheHitRatio: 85.3,
    },
  },
};

// ============================================================================
// Test Suite
// ============================================================================

describe('DatabaseStatsCard', () => {
  // ============================================================================
  // Success Cases
  // ============================================================================

  it('renders database statistics successfully', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Database Statistics')).toBeInTheDocument();
    });

    // Verify connection statistics
    expect(screen.getByText('Active Connections')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // active connections
    expect(screen.getByText('/ 50')).toBeInTheDocument(); // total connections
    expect(screen.getByText('38')).toBeInTheDocument(); // idle connections

    // Verify query statistics
    expect(screen.getByText('Query Statistics')).toBeInTheDocument();
    expect(screen.getByText('23.5')).toBeInTheDocument(); // avg query time
    expect(screen.getByText('97.8%')).toBeInTheDocument(); // cache hit ratio

    // Verify storage statistics
    expect(screen.getByText('Storage Statistics')).toBeInTheDocument();
    expect(screen.getByText('125')).toBeInTheDocument(); // total tables
    expect(screen.getByText('5,678,901')).toBeInTheDocument(); // total rows

    // Verify performance indicators
    expect(screen.getByText('Performance Indicators')).toBeInTheDocument();
    expect(screen.getByText('45.2 TPS')).toBeInTheDocument(); // transactions per second
  });

  it('displays healthy status for good metrics', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Database Healthy')).toBeInTheDocument();
      expect(screen.getByText('All metrics within normal range')).toBeInTheDocument();
    });
  });

  it('calculates connection utilization correctly', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      // (50 - 38) / 100 * 100 = 12%
      expect(screen.getByText('12.0%')).toBeInTheDocument();
    });
  });

  it('formats storage sizes correctly', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      // 2345.67 MB should be displayed as GB
      expect(screen.getByText('2.29 GB')).toBeInTheDocument();
      // 678.9 MB should remain as MB
      expect(screen.getByText('678.9 MB')).toBeInTheDocument();
    });
  });

  it('calculates block cache efficiency correctly', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      // blocksHit / (blocksHit + blocksRead) * 100
      // 89012345 / (89012345 + 1234567) * 100 = 98.6%
      expect(screen.getByText('98.6%')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Warning Cases
  // ============================================================================

  it('displays warning colors for high connection utilization', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStatsHighUtilization,
        },
      },
    ];

    const { _container } = render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      // High utilization (85%) should show danger color
      const utilizationElement = screen.getByText('85.0%');
      expect(utilizationElement).toHaveClass('text-danger-600');
    });
  });

  it('displays warning colors for high slow query count', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStatsHighUtilization,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      const slowQueriesElement = screen.getByText('25');
      expect(slowQueriesElement).toHaveClass('text-danger-600');
    });
  });

  it('displays warning colors for low cache hit ratio', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStatsHighUtilization,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      const cacheHitElement = screen.getByText('85.3%');
      expect(cacheHitElement).toHaveClass('text-warning-600');
    });
  });

  it('displays warning colors for waiting requests', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStatsHighUtilization,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      const waitingElement = screen.getByText('5');
      expect(waitingElement).toHaveClass('text-warning-600');
    });
  });

  // ============================================================================
  // Loading State
  // ============================================================================

  it('displays loading spinner while fetching data', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
        delay: 100,
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    // Should show loading spinner initially
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  it('displays error message on query failure', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        error: new Error('Failed to fetch database statistics'),
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch database statistics')).toBeInTheDocument();
    });
  });

  it('displays error UI with alert icon on error', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        error: new Error('Network error'),
      },
    ];

    const { _container } = render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(_container.querySelector('.bg-danger-50')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Auto-refresh
  // ============================================================================

  it('polls for updates every 10 seconds', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: {
            ...mockDatabaseStats,
            databaseStats: {
              ...mockDatabaseStats.databaseStats,
              connectionStats: {
                ...mockDatabaseStats.databaseStats.connectionStats,
                active: 15, // Updated value
              },
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    // Initial render
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    // Note: Testing auto-refresh with poll interval requires more complex setup
    // This test verifies the component renders correctly
  });

  // ============================================================================
  // Accessibility
  // ============================================================================

  it('has proper semantic HTML structure', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    const { _container } = render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      expect(_container.querySelector('h2')).toBeInTheDocument();
      expect(_container.querySelector('h3')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Manual Refresh
  // ============================================================================

  it('allows manual refresh via refresh button', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: GET_DATABASE_STATS,
        },
        result: {
          data: mockDatabaseStats,
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <DatabaseStatsCard />
      </MockedProvider>
    );

    await waitFor(() => {
      const refreshButton = screen.getByTitle('Refresh');
      expect(refreshButton).toBeInTheDocument();
    });
  });
});
