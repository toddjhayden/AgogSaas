/**
 * Workflow Recovery & Monitoring Dashboard
 * REQ: REQ-1767126043619 - Workflow Recovery & Monitoring System
 *
 * Provides comprehensive monitoring and recovery capabilities for workflows:
 * - Checkpoint management and restoration
 * - Retry state tracking with circuit breaker monitoring
 * - Dead Letter Queue (DLQ) message management
 * - Real-time metrics and alerting
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Play,
  UserPlus,
  Database,
  RotateCcw,
  Activity,
} from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

import {
  GET_PENDING_RETRIES,
  GET_DLQ_MESSAGES,
  GET_DLQ_METRICS,
} from '../graphql/queries/workflowRecovery';
import {
  REPLAY_DLQ_MESSAGE,
  REPLAY_ALL_DLQ_MESSAGES,
  DISCARD_DLQ_MESSAGE,
  ASSIGN_DLQ_MESSAGE,
  RESET_CIRCUIT_BREAKER,
} from '../graphql/mutations/workflowRecovery';

type DLQSource = 'WORKFLOW' | 'NATS' | 'ORCHESTRATOR';
type DLQStatus = 'PENDING' | 'INVESTIGATING' | 'REPLAYING' | 'DISCARDED';

interface RetryState {
  instanceId: string;
  nodeKey: string;
  attemptNumber: number;
  nextRetryAt: string;
  lastError: string;
  circuitBreakerOpen: boolean;
}

interface DLQMessage {
  dlqId: string;
  source: DLQSource;
  payload: any;
  error: string;
  metadata: any;
  status: DLQStatus;
  assignedTo?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

interface DLQMetrics {
  totalMessages: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  oldestMessage?: string;
  averageAgeHours: number;
}

export const WorkflowRecoveryMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState('retries');
  const [dlqSourceFilter, setDlqSourceFilter] = useState<DLQSource | undefined>();
  const [dlqStatusFilter, setDlqStatusFilter] = useState<DLQStatus | undefined>();
  const [selectedDLQMessage, setSelectedDLQMessage] = useState<DLQMessage | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState('');
  const [assignTo, setAssignTo] = useState('');

  // Queries
  const { data: retriesData, loading: retriesLoading, refetch: refetchRetries } = useQuery(
    GET_PENDING_RETRIES,
    {
      pollInterval: 30000, // Refresh every 30 seconds
    }
  );

  const { data: dlqData, loading: dlqLoading, refetch: refetchDLQ } = useQuery(
    GET_DLQ_MESSAGES,
    {
      variables: {
        source: dlqSourceFilter,
        status: dlqStatusFilter,
        limit: 100,
      },
      pollInterval: 30000,
    }
  );

  const { data: metricsData } = useQuery(GET_DLQ_METRICS, {
    pollInterval: 60000, // Refresh every minute
  });

  // Mutations
  const [replayDLQMessage] = useMutation(REPLAY_DLQ_MESSAGE, {
    onCompleted: () => {
      refetchDLQ();
    },
  });

  const [replayAllDLQMessages] = useMutation(REPLAY_ALL_DLQ_MESSAGES, {
    onCompleted: () => {
      refetchDLQ();
    },
  });

  const [discardDLQMessage] = useMutation(DISCARD_DLQ_MESSAGE, {
    onCompleted: () => {
      setDiscardDialogOpen(false);
      setDiscardReason('');
      setSelectedDLQMessage(null);
      refetchDLQ();
    },
  });

  const [assignDLQMessage] = useMutation(ASSIGN_DLQ_MESSAGE, {
    onCompleted: () => {
      setAssignDialogOpen(false);
      setAssignTo('');
      setSelectedDLQMessage(null);
      refetchDLQ();
    },
  });

  const [resetCircuitBreaker] = useMutation(RESET_CIRCUIT_BREAKER, {
    onCompleted: () => {
      refetchRetries();
    },
  });

  const pendingRetries: RetryState[] = retriesData?.pendingRetries || [];
  const dlqMessages: DLQMessage[] = dlqData?.dlqMessages || [];
  const metrics: DLQMetrics = metricsData?.dlqMetrics || {
    totalMessages: 0,
    bySource: {},
    byStatus: {},
    averageAgeHours: 0,
  };

  const handleReplayMessage = async (dlqId: string) => {
    try {
      await replayDLQMessage({ variables: { dlqId } });
    } catch (error) {
      console.error('Failed to replay message:', error);
    }
  };

  const handleReplayAll = async () => {
    try {
      await replayAllDLQMessages({ variables: { source: dlqSourceFilter } });
    } catch (error) {
      console.error('Failed to replay all messages:', error);
    }
  };

  const handleDiscardMessage = async () => {
    if (!selectedDLQMessage) return;
    try {
      await discardDLQMessage({
        variables: {
          dlqId: selectedDLQMessage.dlqId,
          reason: discardReason,
        },
      });
    } catch (error) {
      console.error('Failed to discard message:', error);
    }
  };

  const handleAssignMessage = async () => {
    if (!selectedDLQMessage) return;
    try {
      await assignDLQMessage({
        variables: {
          dlqId: selectedDLQMessage.dlqId,
          assignedTo: assignTo,
        },
      });
    } catch (error) {
      console.error('Failed to assign message:', error);
    }
  };

  const handleResetCircuitBreaker = async (nodeKey: string) => {
    try {
      await resetCircuitBreaker({ variables: { nodeKey } });
    } catch (error) {
      console.error('Failed to reset circuit breaker:', error);
    }
  };

  const getStatusBadge = (status: DLQStatus) => {
    const badges = {
      PENDING: <Badge variant="warning">{t('workflowRecovery.status.pending')}</Badge>,
      INVESTIGATING: <Badge variant="default">{t('workflowRecovery.status.investigating')}</Badge>,
      REPLAYING: <Badge variant="default">{t('workflowRecovery.status.replaying')}</Badge>,
      DISCARDED: <Badge variant="outline">{t('workflowRecovery.status.discarded')}</Badge>,
    };
    return badges[status];
  };

  const getSourceIcon = (source: DLQSource) => {
    const icons = {
      WORKFLOW: <Activity className="h-4 w-4" />,
      NATS: <Database className="h-4 w-4" />,
      ORCHESTRATOR: <RefreshCw className="h-4 w-4" />,
    };
    return icons[source];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('workflowRecovery.title')}</h1>
          <p className="text-muted-foreground">{t('workflowRecovery.subtitle')}</p>
        </div>
        <Button onClick={() => {
          refetchRetries();
          refetchDLQ();
        }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('workflowRecovery.metrics.totalDLQMessages')}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMessages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('workflowRecovery.metrics.pendingRetries')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRetries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('workflowRecovery.metrics.averageAge')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageAgeHours.toFixed(1)}h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('workflowRecovery.metrics.circuitBreakersOpen')}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingRetries.filter(r => r.circuitBreakerOpen).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="retries">
            <Clock className="mr-2 h-4 w-4" />
            {t('workflowRecovery.tabs.retries')}
          </TabsTrigger>
          <TabsTrigger value="dlq">
            <AlertCircle className="mr-2 h-4 w-4" />
            {t('workflowRecovery.tabs.dlq')}
          </TabsTrigger>
        </TabsList>

        {/* Pending Retries Tab */}
        <TabsContent value="retries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('workflowRecovery.retries.title')}</CardTitle>
              <CardDescription>
                {t('workflowRecovery.retries.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {retriesLoading ? (
                <div className="flex justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : pendingRetries.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('workflowRecovery.retries.noPending')}
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('workflowRecovery.retries.instanceId')}</TableHead>
                      <TableHead>{t('workflowRecovery.retries.nodeKey')}</TableHead>
                      <TableHead>{t('workflowRecovery.retries.attempt')}</TableHead>
                      <TableHead>{t('workflowRecovery.retries.nextRetry')}</TableHead>
                      <TableHead>{t('workflowRecovery.retries.error')}</TableHead>
                      <TableHead>{t('workflowRecovery.retries.status')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRetries.map((retry) => (
                      <TableRow key={`${retry.instanceId}-${retry.nodeKey}`}>
                        <TableCell className="font-mono text-xs">
                          {retry.instanceId.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{retry.nodeKey}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {retry.attemptNumber}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(retry.nextRetryAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {retry.lastError}
                        </TableCell>
                        <TableCell>
                          {retry.circuitBreakerOpen ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {t('workflowRecovery.retries.circuitOpen')}
                            </Badge>
                          ) : (
                            <Badge variant="default">
                              <Clock className="mr-1 h-3 w-3" />
                              {t('workflowRecovery.retries.scheduled')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {retry.circuitBreakerOpen && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetCircuitBreaker(retry.nodeKey)}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              {t('workflowRecovery.retries.resetCircuit')}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dead Letter Queue Tab */}
        <TabsContent value="dlq" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{t('workflowRecovery.dlq.title')}</CardTitle>
                  <CardDescription>
                    {t('workflowRecovery.dlq.description')}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={dlqSourceFilter || 'all'}
                    onValueChange={(value: string) =>
                      setDlqSourceFilter(value === 'all' ? undefined : (value as DLQSource))
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('workflowRecovery.dlq.filterBySource')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="WORKFLOW">{t('workflowRecovery.dlq.sources.workflow')}</SelectItem>
                      <SelectItem value="NATS">{t('workflowRecovery.dlq.sources.nats')}</SelectItem>
                      <SelectItem value="ORCHESTRATOR">{t('workflowRecovery.dlq.sources.orchestrator')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={dlqStatusFilter || 'all'}
                    onValueChange={(value: string) =>
                      setDlqStatusFilter(value === 'all' ? undefined : (value as DLQStatus))
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('workflowRecovery.dlq.filterByStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('common.all')}</SelectItem>
                      <SelectItem value="PENDING">{t('workflowRecovery.status.pending')}</SelectItem>
                      <SelectItem value="INVESTIGATING">{t('workflowRecovery.status.investigating')}</SelectItem>
                      <SelectItem value="REPLAYING">{t('workflowRecovery.status.replaying')}</SelectItem>
                      <SelectItem value="DISCARDED">{t('workflowRecovery.status.discarded')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleReplayAll} variant="outline">
                    <Play className="mr-2 h-4 w-4" />
                    {t('workflowRecovery.dlq.replayAll')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dlqLoading ? (
                <div className="flex justify-center p-8">
                  <RefreshCw className="h-8 w-8 animate-spin" />
                </div>
              ) : dlqMessages.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('workflowRecovery.dlq.noMessages')}
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('workflowRecovery.dlq.source')}</TableHead>
                      <TableHead>{t('workflowRecovery.dlq.error')}</TableHead>
                      <TableHead>{t('workflowRecovery.dlq.status')}</TableHead>
                      <TableHead>{t('workflowRecovery.dlq.assignedTo')}</TableHead>
                      <TableHead>{t('workflowRecovery.dlq.createdAt')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dlqMessages.map((msg) => (
                      <TableRow key={msg.dlqId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSourceIcon(msg.source)}
                            {t(`workflowRecovery.dlq.sources.${msg.source.toLowerCase()}`)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {msg.error}
                        </TableCell>
                        <TableCell>{getStatusBadge(msg.status)}</TableCell>
                        <TableCell>{msg.assignedTo || '—'}</TableCell>
                        <TableCell>
                          {new Date(msg.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {msg.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReplayMessage(msg.dlqId)}
                                >
                                  <Play className="mr-1 h-3 w-3" />
                                  {t('workflowRecovery.dlq.replay')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDLQMessage(msg);
                                    setAssignDialogOpen(true);
                                  }}
                                >
                                  <UserPlus className="mr-1 h-3 w-3" />
                                  {t('workflowRecovery.dlq.assign')}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDLQMessage(msg);
                                    setDiscardDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  {t('workflowRecovery.dlq.discard')}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Discard Dialog */}
      <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workflowRecovery.dlq.discardDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('workflowRecovery.dlq.discardDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">{t('workflowRecovery.dlq.discardDialog.reason')}</Label>
              <Textarea
                id="reason"
                value={discardReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDiscardReason(e.target.value)}
                placeholder={t('workflowRecovery.dlq.discardDialog.reasonPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDiscardMessage} disabled={!discardReason}>
              {t('workflowRecovery.dlq.discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workflowRecovery.dlq.assignDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('workflowRecovery.dlq.assignDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assignTo">{t('workflowRecovery.dlq.assignDialog.assignTo')}</Label>
              <Input
                id="assignTo"
                value={assignTo}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssignTo(e.target.value)}
                placeholder={t('workflowRecovery.dlq.assignDialog.assignToPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleAssignMessage} disabled={!assignTo}>
              {t('workflowRecovery.dlq.assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkflowRecoveryMonitorPage;
