/**
 * DATABASE PERFORMANCE DASHBOARD
 * REQ: REQ-P0-1767915020217-kcl8m
 * Author: Jen (Frontend Developer)
 * Date: 2026-01-08
 *
 * Comprehensive database performance monitoring dashboard.
 * Displays health metrics, query performance, connection pool status,
 * and identifies performance bottlenecks.
 *
 * Related Backend:
 * - GraphQL Schema: backend/src/graphql/schema/database-performance.graphql
 * - Resolver: backend/src/graphql/resolvers/database-performance.resolver.ts
 * - Service: backend/src/modules/monitoring/services/database-performance.service.ts
 */

import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import {
  GET_DATABASE_PERFORMANCE_DASHBOARD,
  GET_DATABASE_CONNECTION_POOL_METRICS,
  GET_DATABASE_TABLE_METRICS,
  GET_DATABASE_INDEX_METRICS,
  GET_DATABASE_QUERY_STATISTICS,
  GET_DATABASE_SLOW_QUERIES,
  GET_DATABASE_BLOATED_TABLES,
  GET_DATABASE_UNUSED_INDEXES,
  GET_DATABASE_PERFORMANCE_HISTORY,
  GET_PG_STAT_STATEMENTS_STATUS,
  DETECT_SLOW_QUERY_ANOMALIES,
  CAPTURE_DATABASE_PERFORMANCE_SNAPSHOT,
} from '../graphql/queries/databasePerformance';
import { useMutation } from '@apollo/client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// =====================================================
// TYPE DEFINITIONS
// =====================================================

interface DatabasePerformanceDashboard {
  connectionPoolUtilization: number;
  activeConnections: number;
  waitingConnections: number;
  longRunningQueries: number;
  cacheHitRatio: number;
  rollbackRatio: number;
  totalDeadlocks: number;
  databaseSize: string;
  databaseSizeBytes: string;
  totalTables: number;
  tablesNeedingVacuum: number;
  totalTablesSize: string;
  totalIndexes: number;
  unusedIndexes: number;
  totalIndexesSize: string;
  avgQueryTimeMs: number;
  slowQueriesCount: number;
  maxReplicationLagSeconds: number;
  databaseHealthScore: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CRITICAL';
  capturedAt: string;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export const DatabasePerformanceDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // =====================================================
  // QUERIES
  // =====================================================

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery(GET_DATABASE_PERFORMANCE_DASHBOARD, {
    pollInterval: autoRefresh ? 30000 : 0, // Auto-refresh every 30s if enabled
  });

  const {
    data: poolData,
    refetch: refetchPool,
  } = useQuery(GET_DATABASE_CONNECTION_POOL_METRICS);

  const {
    data: tableData,
    loading: tableLoading,
    refetch: refetchTables,
  } = useQuery(GET_DATABASE_TABLE_METRICS, {
    variables: { filter: { limit: 20 } },
  });

  const {
    data: indexData,
    loading: indexLoading,
    refetch: refetchIndexes,
  } = useQuery(GET_DATABASE_INDEX_METRICS, {
    variables: { filter: { limit: 20 } },
  });

  const {
    refetch: refetchQueryStats,
  } = useQuery(GET_DATABASE_QUERY_STATISTICS, {
    variables: { limit: 50 },
  });

  const {
    data: slowQueriesData,
    loading: slowQueriesLoading,
    refetch: refetchSlowQueries,
  } = useQuery(GET_DATABASE_SLOW_QUERIES, {
    variables: { thresholdMs: 1000, limit: 20 },
  });

  const {
    data: bloatedTablesData,
    loading: bloatedTablesLoading,
  } = useQuery(GET_DATABASE_BLOATED_TABLES, {
    variables: { threshold: 20 },
  });

  const {
    data: unusedIndexesData,
    loading: unusedIndexesLoading,
  } = useQuery(GET_DATABASE_UNUSED_INDEXES, {
    variables: { minSizeMb: 1 },
  });

  const {
    data: historyData,
    loading: historyLoading,
  } = useQuery(GET_DATABASE_PERFORMANCE_HISTORY, {
    variables: { hoursBack: 24, interval: '1 hour' },
  });

  const {
    data: pgStatStatementsStatus,
  } = useQuery(GET_PG_STAT_STATEMENTS_STATUS);

  const {
    data: anomaliesData,
  } = useQuery(DETECT_SLOW_QUERY_ANOMALIES, {
    variables: { meanThresholdMs: 5000, totalThresholdMs: 60000 },
  });

  // =====================================================
  // MUTATIONS
  // =====================================================

  const [captureSnapshot] = useMutation(CAPTURE_DATABASE_PERFORMANCE_SNAPSHOT, {
    onCompleted: () => {
      refetchDashboard();
      refetchPool();
    },
  });

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleRefreshAll = () => {
    refetchDashboard();
    refetchPool();
    refetchTables();
    refetchIndexes();
    refetchQueryStats();
    refetchSlowQueries();
  };

  const handleCaptureSnapshot = () => {
    captureSnapshot();
  };

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-green-500';
      case 'DEGRADED':
        return 'bg-yellow-500';
      case 'UNHEALTHY':
        return 'bg-orange-500';
      case 'CRITICAL':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'DEGRADED':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'UNHEALTHY':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'CRITICAL':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
    return `${(ms / 60000).toFixed(2)} min`;
  };

  // =====================================================
  // LOADING & ERROR STATES
  // =====================================================

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <Alert variant="error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('database.performance.error.title')}</strong>
          <p>{dashboardError.message || t('database.performance.error.loadFailed')}</p>
        </AlertDescription>
      </Alert>
    );
  }

  const dashboard: DatabasePerformanceDashboard = dashboardData?.databasePerformanceDashboard;

  // =====================================================
  // CHART DATA PREPARATION
  // =====================================================

  const historyChartData = {
    labels: historyData?.databasePerformanceHistory?.map((h: unknown) =>
      new Date(h.capturedAt).toLocaleTimeString()
    ) || [],
    datasets: [
      {
        label: t('database.performance.chart.healthScore'),
        data: historyData?.databasePerformanceHistory?.map((h: unknown) => h.databaseHealthScore) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: t('database.performance.chart.cacheHitRatio'),
        data: historyData?.databasePerformanceHistory?.map((h: unknown) => h.cacheHitRatio) || [],
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.1,
      },
      {
        label: t('database.performance.chart.poolUtilization'),
        data: historyData?.databasePerformanceHistory?.map((h: unknown) => h.connectionPoolUtilization) || [],
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ],
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('database.performance.title')}</h1>
          <p className="text-muted-foreground">
            {t('database.performance.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? t('common.autoRefreshOn') : t('common.autoRefreshOff')}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
          <Button variant="default" size="sm" onClick={handleCaptureSnapshot}>
            {t('database.performance.captureSnapshot')}
          </Button>
        </div>
      </div>

      {/* Health Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Health Score Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('database.performance.healthScore')}
            </CardTitle>
            {getHealthStatusIcon(dashboard.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.databaseHealthScore.toFixed(1)}/100
            </div>
            <Badge className={getHealthStatusColor(dashboard.status)}>
              {dashboard.status}
            </Badge>
          </CardContent>
        </Card>

        {/* Connection Pool Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('database.performance.connectionPool')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.connectionPoolUtilization.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard.activeConnections} {t('database.performance.activeConnections')}
            </p>
          </CardContent>
        </Card>

        {/* Cache Hit Ratio Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('database.performance.cacheHitRatio')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.cacheHitRatio.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard.cacheHitRatio >= 95 ? t('database.performance.excellent') : t('database.performance.needsImprovement')}
            </p>
          </CardContent>
        </Card>

        {/* Avg Query Time Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('database.performance.avgQueryTime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.avgQueryTimeMs.toFixed(2)} ms
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard.slowQueriesCount} {t('database.performance.slowQueries')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issues & Alerts */}
      {(dashboard.longRunningQueries > 0 ||
        dashboard.tablesNeedingVacuum > 0 ||
        dashboard.unusedIndexes > 0 ||
        !pgStatStatementsStatus?.pgStatStatementsStatus?.enabled) && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{t('database.performance.issuesDetected')}</strong>
            <ul className="list-disc list-inside space-y-1">
              {dashboard.longRunningQueries > 0 && (
                <li>
                  {dashboard.longRunningQueries} {t('database.performance.longRunningQueries')}
                </li>
              )}
              {dashboard.tablesNeedingVacuum > 0 && (
                <li>
                  {dashboard.tablesNeedingVacuum} {t('database.performance.tablesNeedingVacuum')}
                </li>
              )}
              {dashboard.unusedIndexes > 0 && (
                <li>
                  {dashboard.unusedIndexes} {t('database.performance.unusedIndexes')}
                </li>
              )}
              {!pgStatStatementsStatus?.pgStatStatementsStatus?.enabled && (
                <li>{t('database.performance.pgStatStatementsDisabled')}</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Anomalies Alert */}
      {anomaliesData?.detectSlowQueryAnomalies?.length > 0 && (
        <Alert variant="error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{t('database.performance.anomaliesDetected')}</strong>
            <p>{anomaliesData.detectSlowQueryAnomalies.length} {t('database.performance.slowQueryAnomalies')}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('database.performance.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="queries">{t('database.performance.tabs.queries')}</TabsTrigger>
          <TabsTrigger value="tables">{t('database.performance.tabs.tables')}</TabsTrigger>
          <TabsTrigger value="indexes">{t('database.performance.tabs.indexes')}</TabsTrigger>
          <TabsTrigger value="issues">{t('database.performance.tabs.issues')}</TabsTrigger>
          <TabsTrigger value="history">{t('database.performance.tabs.history')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Database Stats */}
            <Card>
              <CardHeader>
                <CardTitle>{t('database.performance.databaseStats')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>{t('database.performance.databaseSize')}</span>
                  <span className="font-mono">{dashboard.databaseSize}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('database.performance.totalTables')}</span>
                  <span className="font-mono">{dashboard.totalTables}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('database.performance.totalIndexes')}</span>
                  <span className="font-mono">{dashboard.totalIndexes}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('database.performance.totalDeadlocks')}</span>
                  <span className="font-mono">{dashboard.totalDeadlocks}</span>
                </div>
              </CardContent>
            </Card>

            {/* Connection Pool Details */}
            {poolData?.databaseConnectionPoolMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('database.performance.connectionPoolDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>{t('database.performance.activeConnections')}</span>
                    <span className="font-mono">
                      {poolData.databaseConnectionPoolMetrics.activeConnections}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('database.performance.idleConnections')}</span>
                    <span className="font-mono">
                      {poolData.databaseConnectionPoolMetrics.idleConnections}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('database.performance.waitingConnections')}</span>
                    <span className="font-mono">
                      {poolData.databaseConnectionPoolMetrics.waitingConnections}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('database.performance.maxConnections')}</span>
                    <span className="font-mono">
                      {poolData.databaseConnectionPoolMetrics.maxConnections}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Queries Tab */}
        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.performance.slowQueries')}</CardTitle>
              <CardDescription>
                {t('database.performance.queriesExceeding')} 1000ms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slowQueriesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('database.performance.query')}</TableHead>
                      <TableHead>{t('database.performance.calls')}</TableHead>
                      <TableHead>{t('database.performance.avgTime')}</TableHead>
                      <TableHead>{t('database.performance.maxTime')}</TableHead>
                      <TableHead>{t('database.performance.cacheHit')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slowQueriesData?.databaseSlowQueries?.map((query: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs max-w-md truncate">
                          {query.queryPreview}
                        </TableCell>
                        <TableCell>{query.calls}</TableCell>
                        <TableCell>{formatDuration(query.meanTimeMs)}</TableCell>
                        <TableCell>{formatDuration(query.maxTimeMs)}</TableCell>
                        <TableCell>
                          {query.cacheHitRatio ? `${query.cacheHitRatio.toFixed(2)}%` : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tables Tab */}
        <TabsContent value="tables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.performance.largestTables')}</CardTitle>
            </CardHeader>
            <CardContent>
              {tableLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('database.performance.table')}</TableHead>
                      <TableHead>{t('database.performance.totalSize')}</TableHead>
                      <TableHead>{t('database.performance.liveTuples')}</TableHead>
                      <TableHead>{t('database.performance.deadTuples')}</TableHead>
                      <TableHead>{t('database.performance.bloatPercent')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableData?.databaseTableMetrics?.map((table: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">
                          {table.schemaname}.{table.tablename}
                        </TableCell>
                        <TableCell>{table.totalSize}</TableCell>
                        <TableCell>{table.liveTuples.toLocaleString()}</TableCell>
                        <TableCell>{table.deadTuples.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              table.deadTuplePercent > 20 ? 'destructive' : 'secondary'
                            }
                          >
                            {table.deadTuplePercent.toFixed(2)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Indexes Tab */}
        <TabsContent value="indexes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.performance.indexMetrics')}</CardTitle>
            </CardHeader>
            <CardContent>
              {indexLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('database.performance.index')}</TableHead>
                      <TableHead>{t('database.performance.table')}</TableHead>
                      <TableHead>{t('database.performance.size')}</TableHead>
                      <TableHead>{t('database.performance.scans')}</TableHead>
                      <TableHead>{t('database.performance.usageCategory')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {indexData?.databaseIndexMetrics?.map((index: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{index.indexname}</TableCell>
                        <TableCell className="font-mono">
                          {index.schemaname}.{index.tablename}
                        </TableCell>
                        <TableCell>{index.indexSize}</TableCell>
                        <TableCell>{index.indexScans.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              index.usageCategory === 'UNUSED'
                                ? 'destructive'
                                : index.usageCategory === 'FREQUENTLY_USED'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {index.usageCategory}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          {/* Bloated Tables */}
          <Card>
            <CardHeader>
              <CardTitle>{t('database.performance.bloatedTables')}</CardTitle>
              <CardDescription>
                {t('database.performance.tablesExceeding')} 20% {t('database.performance.deadTuples')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bloatedTablesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : bloatedTablesData?.databaseBloatedTables?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('database.performance.table')}</TableHead>
                      <TableHead>{t('database.performance.size')}</TableHead>
                      <TableHead>{t('database.performance.bloatPercent')}</TableHead>
                      <TableHead>{t('database.performance.hoursSinceVacuum')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bloatedTablesData.databaseBloatedTables.map((table: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">
                          {table.schemaName}.{table.tableName}
                        </TableCell>
                        <TableCell>{table.totalSize}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{table.bloatPercent.toFixed(2)}%</Badge>
                        </TableCell>
                        <TableCell>{table.hoursSinceVacuum.toFixed(1)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">{t('database.performance.noBloatedTables')}</p>
              )}
            </CardContent>
          </Card>

          {/* Unused Indexes */}
          <Card>
            <CardHeader>
              <CardTitle>{t('database.performance.unusedIndexes')}</CardTitle>
              <CardDescription>
                {t('database.performance.indexesNotScanned')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unusedIndexesLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : unusedIndexesData?.databaseUnusedIndexes?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('database.performance.index')}</TableHead>
                      <TableHead>{t('database.performance.table')}</TableHead>
                      <TableHead>{t('database.performance.size')}</TableHead>
                      <TableHead>{t('database.performance.scans')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unusedIndexesData.databaseUnusedIndexes.map((index: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{index.indexName}</TableCell>
                        <TableCell className="font-mono">
                          {index.schemaName}.{index.tableName}
                        </TableCell>
                        <TableCell>{index.indexSize}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{index.indexScans}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">{t('database.performance.noUnusedIndexes')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('database.performance.performanceTrends')}</CardTitle>
              <CardDescription>
                {t('database.performance.last24Hours')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="h-80">
                  <Line
                    data={historyChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                        },
                      },
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabasePerformanceDashboard;
