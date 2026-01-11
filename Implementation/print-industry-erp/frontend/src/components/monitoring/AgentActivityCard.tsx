import { useQuery } from '@apollo/client';
import { Card, CardContent, Typography, Alert, Grid, Box, Chip, LinearProgress, CircularProgress } from '@mui/material';
import { GET_AGENT_ACTIVITIES } from '@graphql/queries';
import { useEffect } from 'react';

interface AgentActivity {
  agentId: string;
  agentName: string;
  status: string;
  currentTask?: string;
  progress?: number;
}

interface AgentActivityCardProps {
  lastRefresh: Date;
}

export const AgentActivityCard = ({ lastRefresh }: AgentActivityCardProps) => {
  const { data, loading, error, refetch } = useQuery(GET_AGENT_ACTIVITIES, {
    pollInterval: 10000,
  });

  useEffect(() => {
    refetch();
  }, [lastRefresh, refetch]);

  if (loading) return <Card><CardContent><CircularProgress /></CardContent></Card>;
  if (error) return <Card><CardContent><Alert severity="error">Failed to load: {error.message}</Alert></CardContent></Card>;

  const agents = data?.agentActivities || [];

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          {agents.map((agent: AgentActivity) => (
            <Grid item xs={12} sm={6} md={4} key={agent.agentId}>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>{agent.agentName}</Typography>
                <Chip 
                  label={agent.status} 
                  color={agent.status === 'RUNNING' ? 'success' : 'default'} 
                  size="small" 
                  sx={{ mb: 1 }} 
                />
                {agent.status === 'RUNNING' && (
                  <>
                    <Typography variant="caption" display="block">{agent.currentTask}</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption">Progress: {agent.progress}%</Typography>
                      <LinearProgress variant="determinate" value={agent.progress} sx={{ mt: 0.5 }} />
                    </Box>
                  </>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};
