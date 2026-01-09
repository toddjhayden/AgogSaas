/**
 * Dependency Status Card Component
 * REQ: REQ-AUDIT-1767982074
 * Author: Jen (Frontend Developer)
 * Date: 2026-01-09
 *
 * Displays health status for an individual runtime dependency
 */

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Alert,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SecurityIcon from '@mui/icons-material/Security';

interface DependencyHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latencyMs?: number;
  error?: string;
  critical: boolean;
  details?: Record<string, unknown>;
}

interface DependencyStatusCardProps {
  dependency: DependencyHealth;
}

export const DependencyStatusCard: React.FC<DependencyStatusCardProps> = ({ dependency }) => {
  const isHealthy = dependency.status === 'healthy';

  return (
    <Card
      sx={{
        border: 2,
        borderColor: isHealthy ? 'success.main' : 'error.main',
        mb: 2,
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {isHealthy ? (
              <CheckCircleIcon color="success" fontSize="large" />
            ) : (
              <ErrorIcon color="error" fontSize="large" />
            )}
            <Typography variant="h6" component="h3">
              {dependency.name}
            </Typography>
          </Box>

          <Box display="flex" gap={1}>
            <Chip
              label={dependency.status.toUpperCase()}
              color={isHealthy ? 'success' : 'error'}
              size="small"
            />
            {dependency.critical && (
              <Chip
                icon={<SecurityIcon />}
                label="CRITICAL"
                color="warning"
                size="small"
              />
            )}
          </Box>
        </Box>

        {dependency.latencyMs !== undefined && (
          <Typography variant="body2" color="text.secondary" mb={1}>
            Response time: {dependency.latencyMs.toFixed(0)}ms
            {dependency.latencyMs > 1000 && ' ⚠️ SLOW'}
          </Typography>
        )}

        {dependency.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" component="strong">
              Error:
            </Typography>{' '}
            {dependency.error}
          </Alert>
        )}

        {dependency.details && Object.keys(dependency.details).length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Details:
            </Typography>
            <Table size="small">
              <TableBody>
                {Object.entries(dependency.details).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                      {key}
                    </TableCell>
                    <TableCell>
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {dependency.critical && !isHealthy && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" component="strong">
              ⚠️ CRITICAL DEPENDENCY FAILURE
            </Typography>
            <Typography variant="body2">
              This failure would cause the application to exit on startup.
            </Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
