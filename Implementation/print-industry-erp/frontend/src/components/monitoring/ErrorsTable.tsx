import { FC, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Collapse,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

interface ErrorRecord {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  frequency: number;
  errorRate: string;
  stackTrace?: string;
  relatedREQ?: string;
}

interface ErrorsTableProps {
  lastRefresh: Date;
}

/**
 * Current Errors Table
 *
 * Displays all active errors from ROADMAP.md:
 * - ERROR-001 through ERROR-009
 * - Severity color coding (CRITICAL=red, HIGH=orange, MEDIUM=yellow)
 * - Click to expand for details
 * - Shows which errors have REQ items assigned
 */
export const ErrorsTable: FC<ErrorsTableProps> = ({ lastRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<ErrorRecord[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    loadErrors();
  }, [lastRefresh]);

  const loadErrors = async () => {
    setLoading(true);

    try {
      // TODO: Replace with actual API call to read ROADMAP.md
      // For now, use mock data based on ROADMAP.md content
      const mockErrors: ErrorRecord[] = [
        {
          id: 'ERROR-009',
          severity: 'CRITICAL',
          message: 'WMS Health Monitoring Log',
          frequency: 1,
          errorRate: '1 errors/minute',
        },
        {
          id: 'ERROR-008',
          severity: 'CRITICAL',
          message: 'Frontend Error Log',
          frequency: 1,
          errorRate: '1 errors/minute',
          stackTrace: '# Frontend Error Log\n{\n  "timestamp": "2025-12-07T01:28:54.785Z",\n  "type": "GraphQL",\n  "message": "GraphQL Error: Invalid tenant ID format"',
        },
        {
          id: 'ERROR-007',
          severity: 'CRITICAL',
          message: 'password authentication failed for user "wms_app_role"',
          frequency: 17,
          errorRate: '4.76 errors/minute',
          relatedREQ: 'REQ-007',
        },
        {
          id: 'ERROR-006',
          severity: 'CRITICAL',
          message: 'Invalid JSON: Bad escaped character in JSON at position N',
          frequency: 1,
          errorRate: '1 errors/minute',
          stackTrace: 'Error: Invalid JSON: Bad escaped character in JSON at position 106 (line 1 column 107)\n    at verify (D:\\GitHub\\WMS\\dist\\api\\server.js:62:23)',
        },
        {
          id: 'ERROR-005',
          severity: 'HIGH',
          message: 'Unknown argument "email" on field "Mutation.login"',
          frequency: 4,
          errorRate: '1.21 errors/minute',
        },
        {
          id: 'ERROR-004',
          severity: 'CRITICAL',
          message: 'Invalid email or password',
          frequency: 5,
          errorRate: '31.42 errors/minute',
        },
        {
          id: 'ERROR-003',
          severity: 'CRITICAL',
          message: 'new row violates row-level security policy for table "users"',
          frequency: 6,
          errorRate: '27.51 errors/minute',
        },
        {
          id: 'ERROR-002',
          severity: 'CRITICAL',
          message: 'Field "RegisterInput.role" of required type "UserRole!" was not provided',
          frequency: 1,
          errorRate: '1 errors/minute',
        },
        {
          id: 'ERROR-001',
          severity: 'CRITICAL',
          message: 'Backend Error Log',
          frequency: 1,
          errorRate: '1 errors/minute',
          stackTrace: '# Backend Error Log\n{\n  "timestamp": "2025-12-07T00:18:12.739Z",\n  "method": "POST",\n  "url": "/graphql"',
        },
      ];

      setErrors(mockErrors);
    } catch (error) {
      console.error('Failed to load errors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleRowClick = (errorId: string) => {
    setExpandedRow(expandedRow === errorId ? null : errorId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (errors.length === 0) {
    return (
      <Card>
        <CardContent>
          <Alert severity="success">
            No errors detected - All systems operational!
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Error ID</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Message</TableCell>
                <TableCell align="right">Frequency</TableCell>
                <TableCell align="right">Error Rate</TableCell>
                <TableCell>Fix Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {errors.map((error) => (
                <>
                  <TableRow
                    key={error.id}
                    hover
                    onClick={() => handleRowClick(error.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {expandedRow === error.id ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {error.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={error.severity}
                        color={getSeverityColor(error.severity)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {error.message}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{error.frequency}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{error.errorRate}</Typography>
                    </TableCell>
                    <TableCell>
                      {error.relatedREQ ? (
                        <Chip
                          label={error.relatedREQ}
                          color="primary"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip label="No fix" size="small" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                      <Collapse in={expandedRow === error.id} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Error Details
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>ID:</strong> {error.id}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Severity:</strong> {error.severity}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Message:</strong> {error.message}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Frequency:</strong> {error.frequency} occurrences
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            <strong>Error Rate:</strong> {error.errorRate}
                          </Typography>
                          {error.stackTrace && (
                            <>
                              <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>
                                Stack Trace (first 5 lines)
                              </Typography>
                              <Box
                                sx={{
                                  p: 1,
                                  bgcolor: 'grey.100',
                                  borderRadius: 1,
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'pre-wrap',
                                  overflowX: 'auto',
                                }}
                              >
                                {error.stackTrace}
                              </Box>
                            </>
                          )}
                          {error.relatedREQ && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                              This error has {error.relatedREQ} assigned - check Active Fixes section
                            </Alert>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Note about data source */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Data source: D:\GitHub\WMS\ROADMAP.md (lines 13-247) | {errors.length} errors detected
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
