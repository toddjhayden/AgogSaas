import { FC, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ErrorMapping {
  errorId: string;
  reqId: string | null;
  status: 'HAS_FIX' | 'NO_FIX' | 'BEING_FIXED';
  message: string;
}

interface ErrorFixMappingCardProps {
  lastRefresh: Date;
}

/**
 * Error → Fix Mapping Card
 *
 * Shows which errors have REQ items assigned:
 * - "ERROR-007 has REQ-007 assigned"
 * - "ERROR-005 being fixed by Roy Chen"
 * - "ERROR-006 has no fix yet"
 *
 * Color coding:
 * - GREEN: Error has fix assigned and is being worked on
 * - ORANGE: Error has no fix yet
 * - BLUE: Error fix is complete
 */
export const ErrorFixMappingCard: FC<ErrorFixMappingCardProps> = ({ lastRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<ErrorMapping[]>([]);

  useEffect(() => {
    loadMappings();
  }, [lastRefresh]);

  const loadMappings = async () => {
    setLoading(true);

    try {
      // TODO: Replace with actual API call
      // For now, use mock data based on ROADMAP.md and OWNER_REQUESTS.md
      const mockMappings: ErrorMapping[] = [
        {
          errorId: 'ERROR-007',
          reqId: 'REQ-007 + COORD-016',
          status: 'BEING_FIXED',
          message: 'Marcus Chen (Ron Davis) fixing database authentication',
        },
        {
          errorId: 'ERROR-001',
          reqId: 'QUALITY-001',
          status: 'BEING_FIXED',
          message: 'Sarah Chen (Billy Thompson) testing all fixes',
        },
        {
          errorId: 'ERROR-008',
          reqId: 'QUALITY-001',
          status: 'BEING_FIXED',
          message: 'Frontend error log - part of quality fixes',
        },
        {
          errorId: 'ERROR-003',
          reqId: 'SECURITY-001 + COORD-015',
          status: 'HAS_FIX',
          message: 'RLS policy fix completed by Roy Chen',
        },
        {
          errorId: 'ERROR-005',
          reqId: null,
          status: 'NO_FIX',
          message: 'Unknown GraphQL argument - needs investigation',
        },
        {
          errorId: 'ERROR-006',
          reqId: null,
          status: 'NO_FIX',
          message: 'JSON parsing error - needs investigation',
        },
        {
          errorId: 'ERROR-004',
          reqId: null,
          status: 'NO_FIX',
          message: 'Invalid credentials - may be user error',
        },
        {
          errorId: 'ERROR-002',
          reqId: null,
          status: 'NO_FIX',
          message: 'GraphQL validation error - needs schema review',
        },
        {
          errorId: 'ERROR-009',
          reqId: null,
          status: 'NO_FIX',
          message: 'Health monitoring log - may not be an error',
        },
      ];

      setMappings(mockMappings);
    } catch (error) {
      console.error('Failed to load error mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HAS_FIX':
        return 'success';
      case 'BEING_FIXED':
        return 'primary';
      case 'NO_FIX':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HAS_FIX':
        return <CheckCircleIcon fontSize="small" />;
      case 'BEING_FIXED':
        return <LinkIcon fontSize="small" />;
      case 'NO_FIX':
        return <WarningAmberIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'HAS_FIX':
        return 'Fixed';
      case 'BEING_FIXED':
        return 'In Progress';
      case 'NO_FIX':
        return 'No Fix';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  const withFix = mappings.filter((m) => m.status !== 'NO_FIX');
  const withoutFix = mappings.filter((m) => m.status === 'NO_FIX');

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        {/* Summary */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Error Coverage
          </Typography>
          <Box display="flex" gap={2} mb={2}>
            <Box textAlign="center">
              <Typography variant="h5" color="success.main">
                {withFix.length}
              </Typography>
              <Typography variant="caption">Has Fix</Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="h5" color="warning.main">
                {withoutFix.length}
              </Typography>
              <Typography variant="caption">No Fix</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Errors With Fixes */}
        {withFix.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom color="success.main">
              Errors Being Fixed ({withFix.length})
            </Typography>
            <List dense>
              {withFix.map((mapping) => (
                <ListItem key={mapping.errorId} disablePadding sx={{ mb: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="body2" fontWeight="bold">
                        {mapping.errorId}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(mapping.status)}
                        label={mapping.reqId}
                        color={getStatusColor(mapping.status)}
                        size="small"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {mapping.message}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Errors Without Fixes */}
        {withoutFix.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom color="warning.main">
              Errors Without Fix ({withoutFix.length})
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              These errors need investigation and REQ assignment
            </Alert>
            <List dense>
              {withoutFix.map((mapping) => (
                <ListItem key={mapping.errorId} disablePadding sx={{ mb: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="body2" fontWeight="bold">
                        {mapping.errorId}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(mapping.status)}
                        label="No Fix"
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {mapping.message}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Data Source Note */}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Mapping: ROADMAP.md errors × OWNER_REQUESTS.md REQs
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
