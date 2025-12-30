import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Alert,
  Chip,
} from '@mui/material';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ConflictInfo } from '../../graphql/queries/quoteCollaboration';
import { useTranslation } from 'react-i18next';

interface ConflictResolutionModalProps {
  open: boolean;
  conflicts: ConflictInfo[];
  onResolve: (resolution: 'use_mine' | 'use_theirs' | 'retry') => void;
  onCancel: () => void;
}

type ConflictResolution = Record<string, 'mine' | 'theirs'>;

/**
 * Modal for resolving version conflicts when multiple users edit the same quote
 */
export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  open,
  conflicts,
  onResolve,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [resolutions, setResolutions] = useState<ConflictResolution>({});

  const handleResolutionChange = (field: string, value: 'mine' | 'theirs') => {
    setResolutions((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleUseAllMine = () => {
    const allMine = conflicts.reduce((acc, conflict) => {
      acc[conflict.field] = 'mine';
      return acc;
    }, {} as ConflictResolution);
    setResolutions(allMine);
  };

  const handleUseAllTheirs = () => {
    const allTheirs = conflicts.reduce((acc, conflict) => {
      acc[conflict.field] = 'theirs';
      return acc;
    }, {} as ConflictResolution);
    setResolutions(allTheirs);
  };

  const handleRetry = () => {
    onResolve('retry');
  };

  const handleApply = () => {
    // Check if all conflicts have been resolved
    const allResolved = conflicts.every((c) => resolutions[c.field]);

    if (!allResolved) {
      return;
    }

    // For now, we'll use a simple strategy:
    // - If all resolutions are 'mine', use 'use_mine'
    // - If all resolutions are 'theirs', use 'use_theirs'
    // - Otherwise, use 'retry' (requires backend support for partial merge)
    const values = Object.values(resolutions);
    const allMine = values.every((v) => v === 'mine');
    const allTheirs = values.every((v) => v === 'theirs');

    if (allMine) {
      onResolve('use_mine');
    } else if (allTheirs) {
      onResolve('use_theirs');
    } else {
      // Mixed resolution - requires backend support
      onResolve('retry');
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return t('collaboration.conflict.noValue');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle color="#ff9800" size={24} />
          <Typography variant="h6">{t('collaboration.conflict.title')}</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('collaboration.conflict.description')}
        </Alert>

        <Typography variant="body2" sx={{ mb: 2 }}>
          {t('collaboration.conflict.instruction')}
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('collaboration.conflict.field')}</TableCell>
                <TableCell>{t('collaboration.conflict.yourValue')}</TableCell>
                <TableCell>{t('collaboration.conflict.currentValue')}</TableCell>
                <TableCell>{t('collaboration.conflict.resolution')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conflicts.map((conflict) => (
                <TableRow key={conflict.field}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {conflict.field}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {t('collaboration.conflict.version')}: {conflict.expectedVersion} →{' '}
                      {conflict.actualVersion}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={formatValue(conflict.attemptedValue)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={formatValue(conflict.currentValue)}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>
                    <RadioGroup
                      row
                      value={resolutions[conflict.field] || ''}
                      onChange={(e) =>
                        handleResolutionChange(conflict.field, e.target.value as 'mine' | 'theirs')
                      }
                    >
                      <FormControlLabel
                        value="mine"
                        control={<Radio size="small" />}
                        label={t('collaboration.conflict.useMine')}
                      />
                      <FormControlLabel
                        value="theirs"
                        control={<Radio size="small" />}
                        label={t('collaboration.conflict.useTheirs')}
                      />
                    </RadioGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button size="small" variant="outlined" onClick={handleUseAllMine}>
            {t('collaboration.conflict.useAllMine')}
          </Button>
          <Button size="small" variant="outlined" onClick={handleUseAllTheirs}>
            {t('collaboration.conflict.useAllTheirs')}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          {t('collaboration.conflict.cancel')}
        </Button>
        <Button
          onClick={handleRetry}
          startIcon={<RefreshCw size={16} />}
          variant="outlined"
          color="primary"
        >
          {t('collaboration.conflict.fetchLatest')}
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          color="primary"
          disabled={!conflicts.every((c) => resolutions[c.field])}
        >
          {t('collaboration.conflict.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
