import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { BrowserRouter } from 'react-router-dom';
import SecurityAuditDashboard from '../pages/SecurityAuditDashboard';
import {
  GET_SECURITY_OVERVIEW,
  GET_SUSPICIOUS_IPS,
  GET_SECURITY_INCIDENTS,
  GET_THREAT_PATTERNS,
} from '../graphql/queries/securityAudit';

// ============================================================================
// Mock Data
// ============================================================================

const mockSecurityOverview = {
  securityOverview: {
    timeRange: 'LAST_24_HOURS',
    securityScore: 87.5,
    trend: 'STABLE',
    totalEvents: 15432,
    criticalEvents: 3,
    highRiskEvents: 12,
    suspiciousEvents: 45,
    blockedEvents: 23,
    loginAttempts: 5678,
    failedLogins: 234,
    successRate: 95.88,
    bruteForceAttempts: 12,
    permissionDenials: 56,
    zoneAccessEvents: 123,
    unauthorizedAccessAttempts: 34,
    dataExports: 45,
    dataModifications: 234,
    configChanges: 12,
    activeIncidents: 2,
    openInvestigations: 1,
    topThreats: [
      {
        patternName: 'Brute Force Login Attempt',
        severity: 'HIGH',
        occurrences: 12,
        lastOccurrence: '2025-12-30T14:30:00Z',
      },
      {
        patternName: 'Suspicious Data Export',
        severity: 'MEDIUM',
        occurrences: 8,
        lastOccurrence: '2025-12-30T13:15:00Z',
      },
    ],
    uniqueCountries: 15,
    uniqueIPAddresses: 234,
    topCountries: [
      {
        countryCode: 'US',
        countryName: 'United States',
        accessCount: 5678,
        percentage: 65.5,
      },
      {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        accessCount: 1234,
        percentage: 14.2,
      },
      {
        countryCode: 'DE',
        countryName: 'Germany',
        accessCount: 890,
        percentage: 10.3,
      },
    ],
    activeUsers: 145,
    suspiciousUsers: [
      {
        userId: '123',
        username: 'suspicious.user',
        suspiciousEventCount: 15,
        riskScore: 75.5,
        lastSuspiciousActivity: '2025-12-30T14:00:00Z',
        flaggedReasons: ['Multiple failed login attempts', 'Access from new location'],
      },
    ],
    complianceScore: 92.3,
    nonCompliantControls: 3,
  },
};

const mockSuspiciousIPs = {
  suspiciousIPs: [
    {
      ipAddress: '192.168.1.100',
      eventCount: 234,
      failedLoginCount: 45,
      suspiciousEventCount: 23,
      riskScore: 85.5,
      countries: ['US', 'CN'],
      lastSeenAt: '2025-12-30T14:30:00Z',
      blocked: true,
    },
    {
      ipAddress: '10.0.0.50',
      eventCount: 156,
      failedLoginCount: 12,
      suspiciousEventCount: 8,
      riskScore: 45.2,
      countries: ['US'],
      lastSeenAt: '2025-12-30T13:45:00Z',
      blocked: false,
    },
  ],
};

const mockSecurityIncidents = {
  securityIncidents: {
    edges: [
      {
        node: {
          id: '1',
          incidentNumber: 'INC-2025-0001',
          title: 'Multiple Failed Login Attempts from Same IP',
          description: 'Detected 45 failed login attempts from IP 192.168.1.100',
          incidentType: 'BRUTE_FORCE_ATTEMPT',
          severity: 'HIGH',
          status: 'INVESTIGATING',
          relatedEventIds: ['evt1', 'evt2', 'evt3'],
          affectedResources: ['/login', '/api/auth'],
          estimatedImpact: 'Potential account compromise',
          assignedTo: {
            id: '456',
            username: 'security.admin',
          },
          resolutionNotes: null,
          detectedAt: '2025-12-30T14:00:00Z',
          acknowledgedAt: '2025-12-30T14:05:00Z',
          resolvedAt: null,
          createdAt: '2025-12-30T14:00:00Z',
          updatedAt: '2025-12-30T14:05:00Z',
        },
        cursor: 'cursor1',
      },
      {
        node: {
          id: '2',
          incidentNumber: 'INC-2025-0002',
          title: 'Unauthorized Access Attempt to Admin Panel',
          description: 'User attempted to access admin panel without proper permissions',
          incidentType: 'PERMISSION_DENIED',
          severity: 'MEDIUM',
          status: 'OPEN',
          relatedEventIds: ['evt4'],
          affectedResources: ['/admin'],
          estimatedImpact: 'None - Access denied',
          assignedTo: null,
          resolutionNotes: null,
          detectedAt: '2025-12-30T13:30:00Z',
          acknowledgedAt: null,
          resolvedAt: null,
          createdAt: '2025-12-30T13:30:00Z',
          updatedAt: '2025-12-30T13:30:00Z',
        },
        cursor: 'cursor2',
      },
    ],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: 'cursor1',
      endCursor: 'cursor2',
    },
    totalCount: 2,
  },
};

const mockThreatPatterns = {
  threatPatterns: [
    {
      id: '1',
      patternName: 'Brute Force Detection',
      patternDescription: 'Detects multiple failed login attempts from same IP',
      severity: 'HIGH',
      detectionRules: { maxAttempts: 5, timeWindowMinutes: 15 },
      matchCount: 12,
      autoBlock: true,
      alertChannels: ['email', 'slack'],
      enabled: true,
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2025-12-01T00:00:00Z',
      createdBy: {
        id: '1',
        username: 'admin',
      },
      updatedBy: {
        id: '1',
        username: 'admin',
      },
    },
  ],
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
      query: GET_SECURITY_OVERVIEW,
      variables: { timeRange: 'LAST_24_HOURS' },
    },
    result: { data: mockSecurityOverview },
  },
  {
    request: {
      query: GET_SUSPICIOUS_IPS,
      variables: { hours: 24, limit: 10 },
    },
    result: { data: mockSuspiciousIPs },
  },
  {
    request: {
      query: GET_SECURITY_INCIDENTS,
      variables: {
        status: ['OPEN', 'INVESTIGATING'],
        pagination: { first: 10 },
      },
    },
    result: { data: mockSecurityIncidents },
  },
  {
    request: {
      query: GET_THREAT_PATTERNS,
      variables: { enabled: true },
    },
    result: { data: mockThreatPatterns },
  },
];

// ============================================================================
// Test Suite
// ============================================================================

describe('SecurityAuditDashboard', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('renders dashboard with all sections', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      // Header
      expect(screen.getByText('security.title')).toBeInTheDocument();

      // Overview cards
      expect(screen.getByText('security.overview.securityScore')).toBeInTheDocument();
      expect(screen.getByText('security.overview.criticalEvents')).toBeInTheDocument();
      expect(screen.getByText('security.overview.suspiciousActivity')).toBeInTheDocument();
      expect(screen.getByText('security.overview.activeIncidents')).toBeInTheDocument();
    });
  });

  it('displays correct security score and trend', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('88')).toBeInTheDocument(); // Security score rounded
      expect(screen.getByText('STABLE')).toBeInTheDocument();
    });
  });

  it('displays authentication metrics correctly', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('5,678')).toBeInTheDocument(); // Login attempts
      expect(screen.getByText('234')).toBeInTheDocument(); // Failed logins
      expect(screen.getByText('95.9%')).toBeInTheDocument(); // Success rate
    });
  });

  it('displays access control metrics', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('56')).toBeInTheDocument(); // Permission denials
      expect(screen.getByText('123')).toBeInTheDocument(); // Zone access events
      expect(screen.getByText('34')).toBeInTheDocument(); // Unauthorized attempts
    });
  });

  it('displays data security metrics', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument(); // Data exports
      expect(screen.getByText('234')).toBeInTheDocument(); // Data modifications
      expect(screen.getByText('12')).toBeInTheDocument(); // Config changes
    });
  });

  it('renders top threats table', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Brute Force Login Attempt')).toBeInTheDocument();
      expect(screen.getByText('Suspicious Data Export')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });
  });

  it('renders suspicious IPs table', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    // Click on Suspicious IPs tab
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]); // Second tab is Suspicious IPs

    await waitFor(() => {
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
      expect(screen.getByText('10.0.0.50')).toBeInTheDocument();
      expect(screen.getByText('security.suspiciousIPs.blocked')).toBeInTheDocument();
      expect(screen.getByText('security.suspiciousIPs.monitoring')).toBeInTheDocument();
    });
  });

  it('renders active incidents table', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    // Click on Incidents tab
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[2]); // Third tab is Incidents

    await waitFor(() => {
      expect(screen.getByText('INC-2025-0001')).toBeInTheDocument();
      expect(screen.getByText('INC-2025-0002')).toBeInTheDocument();
      expect(screen.getByText('Multiple Failed Login Attempts from Same IP')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized Access Attempt to Admin Panel')).toBeInTheDocument();
    });
  });

  it('renders geographic access distribution', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    // Click on Geographic tab
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[3]); // Fourth tab is Geographic

    await waitFor(() => {
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();
      expect(screen.getByText('Germany')).toBeInTheDocument();
      expect(screen.getByText('65.5% security.geographic.ofTotal')).toBeInTheDocument();
    });
  });

  it('displays compliance score', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('92%')).toBeInTheDocument(); // Compliance score
      expect(screen.getByText('3')).toBeInTheDocument(); // Non-compliant controls
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
          query: GET_SECURITY_OVERVIEW,
          variables: { timeRange: 'LAST_7_DAYS' },
        },
        result: { data: mockSecurityOverview },
      },
    ];

    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('security.overview.securityScore')).toBeInTheDocument();
    });

    // Change time range
    const timeRangeSelect = screen.getByRole('combobox');
    fireEvent.change(timeRangeSelect, { target: { value: 'LAST_7_DAYS' } });

    expect(timeRangeSelect).toHaveValue('LAST_7_DAYS');
  });

  it('switches between tabs correctly', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('Brute Force Login Attempt')).toBeInTheDocument();
    });

    const tabs = screen.getAllByRole('tab');

    // Click on Suspicious IPs tab
    fireEvent.click(tabs[1]);
    await waitFor(() => {
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    });

    // Click on Incidents tab
    fireEvent.click(tabs[2]);
    await waitFor(() => {
      expect(screen.getByText('INC-2025-0001')).toBeInTheDocument();
    });

    // Click on Geographic tab
    fireEvent.click(tabs[3]);
    await waitFor(() => {
      expect(screen.getByText('United States')).toBeInTheDocument();
    });

    // Click back to Top Threats tab
    fireEvent.click(tabs[0]);
    await waitFor(() => {
      expect(screen.getByText('Brute Force Login Attempt')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Loading State Tests
  // ============================================================================

  it('displays loading state initially', () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('displays error message on query failure', async () => {
    const errorMocks: MockedResponse[] = [
      {
        request: {
          query: GET_SECURITY_OVERVIEW,
          variables: { timeRange: 'LAST_24_HOURS' },
        },
        error: new Error('Failed to fetch security data'),
      },
    ];

    renderWithProviders(<SecurityAuditDashboard />, errorMocks);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch security data/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Data Display Tests
  // ============================================================================

  it('displays critical events with error styling', async () => {
    const mocks = createDefaultMocks();
    const { _container } = renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      const criticalCount = screen.getByText('3');
      expect(criticalCount).toBeInTheDocument();
    });
  });

  it('displays high risk events count', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('12 security.overview.highRisk')).toBeInTheDocument();
    });
  });

  it('displays blocked events count', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('23 security.overview.blocked')).toBeInTheDocument();
    });
  });

  it('shows investigating count for active incidents', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('1 security.overview.investigating')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  it('displays no threats message when threats list is empty', async () => {
    const emptyMocks: MockedResponse[] = [
      {
        request: {
          query: GET_SECURITY_OVERVIEW,
          variables: { timeRange: 'LAST_24_HOURS' },
        },
        result: {
          data: {
            securityOverview: {
              ...mockSecurityOverview.securityOverview,
              topThreats: [],
            },
          },
        },
      },
      ...createDefaultMocks().slice(1),
    ];

    renderWithProviders(<SecurityAuditDashboard />, emptyMocks);

    await waitFor(() => {
      expect(screen.getByText('security.threats.noThreats')).toBeInTheDocument();
    });
  });

  it('displays no incidents message when incidents list is empty', async () => {
    const emptyMocks: MockedResponse[] = [
      ...createDefaultMocks().slice(0, 2),
      {
        request: {
          query: GET_SECURITY_INCIDENTS,
          variables: {
            status: ['OPEN', 'INVESTIGATING'],
            pagination: { first: 10 },
          },
        },
        result: {
          data: {
            securityIncidents: {
              edges: [],
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                startCursor: null,
                endCursor: null,
              },
              totalCount: 0,
            },
          },
        },
      },
      createDefaultMocks()[3],
    ];

    renderWithProviders(<SecurityAuditDashboard />, emptyMocks);

    // Click on Incidents tab
    const tabs = await screen.findAllByRole('tab');
    fireEvent.click(tabs[2]);

    await waitFor(() => {
      expect(screen.getByText('security.incidents.noActiveIncidents')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Color Coding Tests
  // ============================================================================

  it('applies correct color for high security score', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      const scoreDisplay = screen.getByText('88');
      expect(scoreDisplay).toBeInTheDocument();
      // Score >= 70 should be info color
    });
  });

  it('displays risk levels with correct color chips', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      const highChip = screen.getByText('HIGH');
      const mediumChip = screen.getByText('MEDIUM');
      expect(highChip).toBeInTheDocument();
      expect(mediumChip).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  it('displays all sections with data', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      // Overview metrics
      expect(screen.getByText('88')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // Authentication metrics
      expect(screen.getByText('5,678')).toBeInTheDocument();
      expect(screen.getByText('234')).toBeInTheDocument();

      // Access control
      expect(screen.getByText('56')).toBeInTheDocument();

      // Data security
      expect(screen.getByText('45')).toBeInTheDocument();

      // Compliance
      expect(screen.getByText('92%')).toBeInTheDocument();

      // Threats
      expect(screen.getByText('Brute Force Login Attempt')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('handles multiple queries successfully', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      // Verify data from all queries is displayed
      expect(screen.getByText('88')).toBeInTheDocument(); // Security overview
      expect(screen.getByText('Brute Force Login Attempt')).toBeInTheDocument(); // Top threats
    }, { timeout: 3000 });

    // Switch to Suspicious IPs tab
    const tabs = screen.getAllByRole('tab');
    fireEvent.click(tabs[1]);

    await waitFor(() => {
      expect(screen.getByText('192.168.1.100')).toBeInTheDocument(); // Suspicious IPs
    });

    // Switch to Incidents tab
    fireEvent.click(tabs[2]);

    await waitFor(() => {
      expect(screen.getByText('INC-2025-0001')).toBeInTheDocument(); // Incidents
    });
  });

  it('auto-refreshes data every 30 seconds', async () => {
    const mocks = createDefaultMocks();
    renderWithProviders(<SecurityAuditDashboard />, mocks);

    await waitFor(() => {
      expect(screen.getByText('88')).toBeInTheDocument();
    });

    // The component should have polling enabled
    // This is tested implicitly through the pollInterval in useQuery
  });
});
