import { useQuery } from '@apollo/client';
import { Card, CardContent, Typography, Alert, List, ListItem, ListItemText, Chip, CircularProgress, Box } from '@mui/material';
import { GET_SYSTEM_ERRORS } from '@graphql/queries';
import { useEffect } from 'react';

interface SystemError {
  id: string;
  severity: string;
  message: string;
  component: string;
}

interface ErrorListCardProps {
  lastRefresh: Date;
}

export const ErrorListCard = ({ lastRefresh }: ErrorListCardProps) => {
  const { data, loading, error, refetch } = useQuery(GET_SYSTEM_ERRORS, {
    variables: { limit: 10 },
    pollInterval: 10000,
  });

  useEffect(() => {
    refetch();
  }, [lastRefresh, refetch]);

  if (loading) return (<Card><CardContent><CircularProgress /></CardContent></Card>);
  if (error) return (<Card><CardContent><Alert severity="error">Failed to load errors</Alert></CardContent></Card>);

  const errors = data?.systemErrors || [];

  return (
    <Card>
      <CardContent>
        {errors.length === 0 ? (
          <Alert severity="success">No errors at this time</Alert>
        ) : (
          <List>
            {errors.map((err: SystemError) => (
              <ListItem key={err.id} divider>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label={err.severity} color={err.severity === 'CRITICAL' ? 'error' : 'warning'} size="small" />
                      <Typography variant="body2">{err.message}</Typography>
                    </Box>
                  }
                  secondary={err.component}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
