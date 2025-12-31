import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  BugReport as BugReportIcon,
  Speed as SpeedIcon,
  ExpandMore as ExpandMoreIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { GET_QUALITY_GATE_VALIDATION } from '../graphql/queries/codeQuality';

/**
 * Quality Gate Validation Detail Page
 * REQ-STRATEGIC-AUTO-1767108044307
 *
 * Displays detailed information about a specific quality gate validation,
 * including all check results, violations, and recommendations.
 */
export const QualityGateValidationDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_QUALITY_GATE_VALIDATION, {
    variables: { id },
    skip: !id,
  });

  const validation = data?.qualityGateValidation;

  const getStatusIcon = (passed: boolean | null | undefined) => {
    if (passed === null || passed === undefined) return <WarningIcon color="disabled" />;
    return passed ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />;
  };

  const getStatusColor = (passed: boolean | null | undefined) => {
    if (passed === null || passed === undefined) return 'default';
    return passed ? 'success' : 'error';
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !validation) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          <AlertTitle>Error Loading Validation</AlertTitle>
          {error?.message || 'Validation not found'}
        </Alert>
        <Box mt={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/quality/code-quality')}>
            Back to Code Quality Dashboard
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/quality/code-quality')}
          sx={{ mb: 2 }}
        >
          Back to Code Quality Dashboard
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Quality Gate Validation Details
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Validation ID: {validation.id}
        </Typography>
      </Box>

      {/* Overall Status Alert */}
      <Alert
        severity={validation.overallPassed ? 'success' : 'error'}
        sx={{ mb: 3 }}
        icon={validation.overallPassed ? <CheckCircleIcon /> : <ErrorIcon />}
      >
        <AlertTitle>
          {validation.overallPassed ? 'Quality Gate Passed' : 'Quality Gate Failed'}
        </AlertTitle>
        {!validation.overallPassed && validation.failureReasons && validation.failureReasons.length > 0 && (
          <Typography variant="body2">
            {validation.failureReasons.join(', ')}
          </Typography>
        )}
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Requirement Number
              </Typography>
              <Typography variant="h6" noWrap>
                {validation.reqNumber}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Agent
              </Typography>
              <Typography variant="h6">{validation.agentName}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Validation Duration
              </Typography>
              <Typography variant="h6">
                {formatDuration(validation.validationDurationMs)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Status
              </Typography>
              <Chip
                label={validation.status}
                color={getStatusColor(validation.overallPassed)}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Validation Checks */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Validation Checks
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {/* Linting */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CodeIcon />
                          <Typography variant="subtitle1">Linting</Typography>
                        </Box>
                        {getStatusIcon(validation.lintingPassed)}
                      </Box>
                      <Chip
                        label={validation.lintingPassed ? 'Passed' : 'Failed'}
                        size="small"
                        color={getStatusColor(validation.lintingPassed)}
                      />
                      {validation.lintingErrors && validation.lintingErrors.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" color="error">
                            {validation.lintingErrors.length} errors found
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Type Checking */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CodeIcon />
                          <Typography variant="subtitle1">Type Checking</Typography>
                        </Box>
                        {getStatusIcon(validation.typeCheckingPassed)}
                      </Box>
                      <Chip
                        label={validation.typeCheckingPassed ? 'Passed' : 'Failed'}
                        size="small"
                        color={getStatusColor(validation.typeCheckingPassed)}
                      />
                      {validation.typeCheckingErrors && validation.typeCheckingErrors.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" color="error">
                            {validation.typeCheckingErrors.length} errors found
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Unit Tests */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <BugReportIcon />
                          <Typography variant="subtitle1">Unit Tests</Typography>
                        </Box>
                        {getStatusIcon(validation.unitTestsPassed)}
                      </Box>
                      <Chip
                        label={validation.unitTestsPassed ? 'Passed' : 'Failed'}
                        size="small"
                        color={getStatusColor(validation.unitTestsPassed)}
                      />
                      {validation.unitTestFailures && validation.unitTestFailures.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" color="error">
                            {validation.unitTestFailures.length} tests failed
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Complexity Check */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <SpeedIcon />
                          <Typography variant="subtitle1">Complexity</Typography>
                        </Box>
                        {getStatusIcon(validation.complexityCheckPassed)}
                      </Box>
                      <Chip
                        label={validation.complexityCheckPassed ? 'Passed' : 'Failed'}
                        size="small"
                        color={getStatusColor(validation.complexityCheckPassed)}
                      />
                      {validation.complexityViolations && validation.complexityViolations.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" color="error">
                            {validation.complexityViolations.length} violations
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Coverage Check */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CodeIcon />
                          <Typography variant="subtitle1">Code Coverage</Typography>
                        </Box>
                        {getStatusIcon(validation.coverageCheckPassed)}
                      </Box>
                      <Chip
                        label={validation.coverageCheckPassed ? 'Passed' : 'Failed'}
                        size="small"
                        color={getStatusColor(validation.coverageCheckPassed)}
                      />
                      {validation.coverageFailures && validation.coverageFailures.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" color="error">
                            {validation.coverageFailures.length} failures
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Security Check */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <SecurityIcon />
                          <Typography variant="subtitle1">Security Scan</Typography>
                        </Box>
                        {getStatusIcon(validation.securityCheckPassed)}
                      </Box>
                      <Chip
                        label={validation.securityCheckPassed ? 'Passed' : 'Failed'}
                        size="small"
                        color={getStatusColor(validation.securityCheckPassed)}
                      />
                      {validation.securityViolations && validation.securityViolations.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" color="error">
                            {validation.securityViolations.length} vulnerabilities
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Error/Violation Lists */}
      <Grid container spacing={3} mb={3}>
        {/* Linting Errors */}
        {validation.lintingErrors && validation.lintingErrors.length > 0 && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Linting Errors ({validation.lintingErrors.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {validation.lintingErrors.map((error: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={error}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Type Checking Errors */}
        {validation.typeCheckingErrors && validation.typeCheckingErrors.length > 0 && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Type Checking Errors ({validation.typeCheckingErrors.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {validation.typeCheckingErrors.map((error: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={error}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Unit Test Failures */}
        {validation.unitTestFailures && validation.unitTestFailures.length > 0 && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Unit Test Failures ({validation.unitTestFailures.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {validation.unitTestFailures.map((failure: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={failure}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Complexity Violations */}
        {validation.complexityViolations && validation.complexityViolations.length > 0 && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Complexity Violations ({validation.complexityViolations.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {validation.complexityViolations.map((violation: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <WarningIcon color="warning" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={violation}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Coverage Failures */}
        {validation.coverageFailures && validation.coverageFailures.length > 0 && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Coverage Failures ({validation.coverageFailures.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {validation.coverageFailures.map((failure: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={failure}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Security Violations */}
        {validation.securityViolations && validation.securityViolations.length > 0 && (
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Security Vulnerabilities ({validation.securityViolations.length})</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {validation.securityViolations.map((violation: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <SecurityIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={violation}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}
      </Grid>

      {/* Recommendations */}
      {validation.recommendations && validation.recommendations.length > 0 && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recommendations
                </Typography>
                <List>
                  {validation.recommendations.map((recommendation: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon color="info" />
                      </ListItemIcon>
                      <ListItemText primary={recommendation} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* File Changes */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Files Created ({validation.filesCreated?.length || 0})
              </Typography>
              {validation.filesCreated && validation.filesCreated.length > 0 ? (
                <List dense>
                  {validation.filesCreated.map((file: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={file}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No files created
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Files Modified ({validation.filesModified?.length || 0})
              </Typography>
              {validation.filesModified && validation.filesModified.length > 0 ? (
                <List dense>
                  {validation.filesModified.map((file: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={file}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No files modified
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Files Deleted ({validation.filesDeleted?.length || 0})
              </Typography>
              {validation.filesDeleted && validation.filesDeleted.length > 0 ? (
                <List dense>
                  {validation.filesDeleted.map((file: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={file}
                        primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: 'monospace' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No files deleted
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};
