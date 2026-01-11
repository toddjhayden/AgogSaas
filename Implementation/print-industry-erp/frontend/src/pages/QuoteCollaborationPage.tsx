import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import { Save, Plus, Trash2, FileText } from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { ActiveUsers } from '../components/collaboration/ActiveUsers';
import { ConflictResolutionModal } from '../components/collaboration/ConflictResolutionModal';
import { useQuoteCollaboration } from '../hooks/useQuoteCollaboration';
import {
  GET_QUOTE,
  UPDATE_QUOTE_LINE_WITH_VERSION_CHECK,
  QuoteLineCollaborationResult,
  ConflictInfo,
  QuoteChangedEvent,
  QuoteLineChangedEvent,
} from '../graphql/queries';

interface QuoteLine {
  id: string;
  lineNumber: number;
  productCode: string;
  description: string;
  quantityQuoted: number;
  unitPrice: number;
  lineAmount: number;
  version: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  subtotal: number;
  totalAmount: number;
  version: number;
  lines: QuoteLine[];
}

/**
 * Quote Collaboration Page with real-time updates and optimistic locking
 */
export const QuoteCollaborationPage: React.FC = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { t } = useTranslation();

  // Mock user data - in production, get from auth context
  const currentUser = {
    userId: 'user-123',
    userName: 'John Doe',
    userEmail: 'john.doe@example.com',
  };

  // Local state
  const [quote, setQuote] = useState<Quote | null>(null);
  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [localChanges, setLocalChanges] = useState<Record<string, Partial<QuoteLine>>>({});
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // GraphQL queries and mutations
  const { data: quoteData, loading, error, refetch } = useQuery(GET_QUOTE, {
    variables: { quoteId },
    skip: !quoteId,
  });

  const [updateQuoteLine] = useMutation<{ updateQuoteLineWithVersionCheck: QuoteLineCollaborationResult }>(
    UPDATE_QUOTE_LINE_WITH_VERSION_CHECK
  );

  // Real-time collaboration hooks
  const { activeUsers, isConnected, updateCursorPosition, setEditingStatus } = useQuoteCollaboration({
    quoteId: quoteId || '',
    userId: currentUser.userId,
    userName: currentUser.userName,
    userEmail: currentUser.userEmail,
    onQuoteChanged: handleQuoteChanged,
    onQuoteLineChanged: handleQuoteLineChanged,
  });

  // Initialize quote from query data
  useEffect(() => {
    if (quoteData?.quote) {
      setQuote(quoteData.quote);
    }
  }, [quoteData]);

  /**
   * Handle real-time quote header changes from other users
   */
  function handleQuoteChanged(event: QuoteChangedEvent) {
    console.log('Quote changed:', event);

    // Update local quote state
    setQuote((prev) => {
      if (!prev) return null;

      const updated = { ...prev } as Record<string, unknown>;
      event.changes.forEach((change) => {
        updated[change.field] = change.newValue;
      });
      updated.version = event.version;

      return updated as unknown as Quote;
    });

    // Show toast notification
    toast(t('collaboration.quoteUpdated', { user: event.userName }), {
      icon: '🔄',
      duration: 3000,
    });
  }

  /**
   * Handle real-time quote line changes from other users
   */
  function handleQuoteLineChanged(event: QuoteLineChangedEvent) {
    console.log('Quote line changed:', event);

    setQuote((prev) => {
      if (!prev) return null;

      const updated = { ...prev };

      if (event.changeType === 'LINE_DELETED') {
        updated.lines = updated.lines.filter((line) => line.id !== event.lineId);
      } else if (event.changeType === 'LINE_ADDED') {
        // Refetch to get new line
        refetch();
        return prev;
      } else {
        // LINE_UPDATED
        updated.lines = updated.lines.map((line) => {
          if (line.id === event.lineId) {
            const updatedLine = { ...line } as Record<string, unknown>;
            event.changes.forEach((change) => {
              updatedLine[change.field] = change.newValue;
            });
            updatedLine.version = event.version;
            return updatedLine as unknown as QuoteLine;
          }
          return line;
        });
      }

      return updated;
    });

    // Show toast notification
    const actionKey = event.changeType.toLowerCase().replace('line_', '');
    toast(t(`collaboration.lineUpdated.${actionKey}`, { user: event.userName }), {
      icon: '✏️',
      duration: 3000,
    });
  }

  /**
   * Handle field change in local state
   */
  const handleFieldChange = useCallback(
    (lineId: string, field: string, value: unknown) => {
      setLocalChanges((prev) => ({
        ...prev,
        [lineId]: {
          ...prev[lineId],
          [field]: value,
        },
      }));

      // Update cursor position
      updateCursorPosition(lineId, field, 0);
    },
    [updateCursorPosition]
  );

  /**
   * Handle focus on field (start editing)
   */
  const handleFieldFocus = useCallback(
    (lineId: string, field: string) => {
      setEditingLine(lineId);
      setEditingStatus(true);
      updateCursorPosition(lineId, field, 0);
    },
    [setEditingStatus, updateCursorPosition]
  );

  /**
   * Handle blur on field (stop editing)
   */
  const handleFieldBlur = useCallback(() => {
    setEditingLine(null);
    setEditingStatus(false);
  }, [setEditingStatus]);

  /**
   * Save changes to a quote line with optimistic locking
   */
  const handleSaveLine = useCallback(
    async (line: QuoteLine) => {
      const changes = localChanges[line.id];
      if (!changes || Object.keys(changes).length === 0) {
        return;
      }

      try {
        const { data } = await updateQuoteLine({
          variables: {
            input: {
              lineId: line.id,
              version: line.version,
              changes,
            },
          },
        });

        const result = data?.updateQuoteLineWithVersionCheck;

        if (result?.success) {
          // Success - update local state
          setQuote((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              lines: prev.lines.map((l) =>
                l.id === line.id ? { ...l, ...result.quoteLine } : l
              ),
            };
          });

          // Clear local changes for this line
          setLocalChanges((prev) => {
            const updated = { ...prev };
            delete updated[line.id];
            return updated;
          });

          toast.success(t('collaboration.lineSaved'));
        } else if (result?.conflicts && result.conflicts.length > 0) {
          // Conflict detected
          setConflicts(result.conflicts);
          setShowConflictModal(true);
        }
      } catch (error) {
        console.error('Failed to save quote line:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error(t('collaboration.saveFailed', { error: errorMessage }));
      }
    },
    [localChanges, updateQuoteLine, t]
  );

  /**
   * Handle conflict resolution
   */
  const handleConflictResolution = useCallback(
    async (resolution: 'use_mine' | 'use_theirs' | 'retry') => {
      if (resolution === 'retry') {
        // Refetch latest data
        await refetch();
        setShowConflictModal(false);
        setConflicts([]);
        toast(t('collaboration.dataRefreshed'));
      } else if (resolution === 'use_mine') {
        // Force update (would need backend support)
        toast(t('collaboration.forceUpdateNotSupported'));
        setShowConflictModal(false);
      } else {
        // Use theirs - discard local changes
        await refetch();
        setLocalChanges({});
        setShowConflictModal(false);
        setConflicts([]);
        toast(t('collaboration.changesDiscarded'));
      }
    },
    [refetch, t]
  );

  /**
   * Get display value for a field (local changes or saved value)
   */
  const getFieldValue = (line: QuoteLine, field: keyof QuoteLine): unknown => {
    const localChange = localChanges[line.id]?.[field];
    return localChange !== undefined ? localChange : line[field];
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common.loading')}</Typography>
      </Box>
    );
  }

  if (error || !quote) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('collaboration.loadError')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            <FileText size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            {t('collaboration.quoteEdit')} - {quote.quoteNumber}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip label={quote.status} color="primary" size="small" />
            <Typography variant="body2" color="textSecondary">
              {t('collaboration.version')}: {quote.version}
            </Typography>
            {isConnected && (
              <Chip label={t('collaboration.connected')} color="success" size="small" />
            )}
          </Box>
        </Box>

        <ActiveUsers users={activeUsers} currentUserId={currentUser.userId} />
      </Box>

      {/* Quote Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 4 }}>
            <Box>
              <Typography variant="body2" color="textSecondary">
                {t('collaboration.subtotal')}
              </Typography>
              <Typography variant="h6">${quote.subtotal.toFixed(2)}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary">
                {t('collaboration.total')}
              </Typography>
              <Typography variant="h6">${quote.totalAmount.toFixed(2)}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Quote Lines Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">{t('collaboration.quoteLines')}</Typography>
            <Button startIcon={<Plus size={16} />} variant="outlined" size="small">
              {t('collaboration.addLine')}
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('collaboration.line')}</TableCell>
                  <TableCell>{t('collaboration.productCode')}</TableCell>
                  <TableCell>{t('collaboration.description')}</TableCell>
                  <TableCell align="right">{t('collaboration.quantity')}</TableCell>
                  <TableCell align="right">{t('collaboration.unitPrice')}</TableCell>
                  <TableCell align="right">{t('collaboration.lineAmount')}</TableCell>
                  <TableCell align="center">{t('collaboration.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {quote.lines.map((line) => (
                  <TableRow
                    key={line.id}
                    sx={{
                      bgcolor: editingLine === line.id ? 'rgba(33, 150, 243, 0.08)' : 'inherit',
                    }}
                  >
                    <TableCell>{line.lineNumber}</TableCell>
                    <TableCell>{line.productCode}</TableCell>
                    <TableCell>
                      <TextField
                        value={getFieldValue(line, 'description')}
                        onChange={(e) => handleFieldChange(line.id, 'description', e.target.value)}
                        onFocus={() => handleFieldFocus(line.id, 'description')}
                        onBlur={handleFieldBlur}
                        size="small"
                        fullWidth
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={getFieldValue(line, 'quantityQuoted')}
                        onChange={(e) =>
                          handleFieldChange(line.id, 'quantityQuoted', parseFloat(e.target.value))
                        }
                        onFocus={() => handleFieldFocus(line.id, 'quantityQuoted')}
                        onBlur={handleFieldBlur}
                        size="small"
                        variant="standard"
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={getFieldValue(line, 'unitPrice')}
                        onChange={(e) =>
                          handleFieldChange(line.id, 'unitPrice', parseFloat(e.target.value))
                        }
                        onFocus={() => handleFieldFocus(line.id, 'unitPrice')}
                        onBlur={handleFieldBlur}
                        size="small"
                        variant="standard"
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        ${(getFieldValue(line, 'lineAmount') as number).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleSaveLine(line)}
                          disabled={!localChanges[line.id]}
                        >
                          <Save size={16} />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        open={showConflictModal}
        conflicts={conflicts}
        onResolve={handleConflictResolution}
        onCancel={() => setShowConflictModal(false)}
      />
    </Box>
  );
};
