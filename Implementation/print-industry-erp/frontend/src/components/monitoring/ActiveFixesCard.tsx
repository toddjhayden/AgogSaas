import { useQuery } from '@apollo/client';
import { Card, CardContent, Typography, Alert, List, ListItem, ListItemText, Chip, CircularProgress, Box } from '@mui/material';
import { GET_ACTIVE_FIXES } from '@graphql/queries';
import { useEffect } from 'react';

interface ActiveFix {
  reqNumber: string;
  status: string;
  title: string;
  owner: string;
  priority: string;
}

interface ActiveFixesCardProps {
  lastRefresh: Date;
}

export const ActiveFixesCard = ({ lastRefresh }: ActiveFixesCardProps) => {
  const { data, loading, error, refetch } = useQuery(GET_ACTIVE_FIXES, {
    pollInterval: 10000,
  });

  useEffect(() => {
    refetch();
  }, [lastRefresh, refetch]);

  if (loading) return <Card><CardContent><CircularProgress /></CardContent></Card>;
  if (error) return <Card><CardContent><Alert severity="error">Failed to load: {error.message}</Alert></CardContent></Card>;

  const fixes = data?.activeFixes || [];

  return (
    <Card>
      <CardContent>
        {fixes.length === 0 ? (
          <Alert severity="info">No active fixes</Alert>
        ) : (
          <List>
            {fixes.map((fix: ActiveFix) => (
              <ListItem key={fix.reqNumber} divider>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label={fix.status} color={fix.status === 'IN_PROGRESS' ? 'primary' : 'default'} size="small" />
                      <Typography variant="body2">{fix.reqNumber}: {fix.title}</Typography>
                    </Box>
                  }
                  secondary={`Owner: ${fix.owner} - Priority: ${fix.priority}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
