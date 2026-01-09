import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { withTranslation, WithTranslation } from 'react-i18next';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child component tree and displays fallback UI.
 * Prevents entire application from crashing when component errors occur.
 *
 * REQ-DEVOPS-ROLLBACK-1767150339448 - P2 Improvement
 *
 * @example
 * <ErrorBoundary>
 *   <RollbackDecisionPage />
 * </ErrorBoundary>
 */

interface Props extends WithTranslation {
  children: ReactNode;
  /**
   * Optional fallback component to display on error
   */
  fallback?: ReactNode;
  /**
   * Optional callback when error occurs
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you would log this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, t } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 600,
              p: 4,
              textAlign: 'center',
            }}
          >
            <ErrorOutlineIcon
              sx={{
                fontSize: 80,
                color: 'error.main',
                mb: 2,
              }}
            />
            <Typography variant="h4" gutterBottom>
              {t('errorBoundary.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {t('errorBoundary.message')}
            </Typography>

            {process.env.NODE_ENV === 'development' && error && (
              <Box
                sx={{
                  mt: 3,
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  overflow: 'auto',
                  maxHeight: 300,
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Error Details (Development Only):
                </Typography>
                <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {error.toString()}
                </Typography>
                {errorInfo && (
                  <Typography
                    component="pre"
                    sx={{ whiteSpace: 'pre-wrap', mt: 1 }}
                  >
                    {errorInfo.componentStack}
                  </Typography>
                )}
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" onClick={this.handleReset}>
                {t('errorBoundary.tryAgain')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => (window.location.href = '/')}
              >
                {t('errorBoundary.goHome')}
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return children;
  }
}

export default withTranslation()(ErrorBoundary);
