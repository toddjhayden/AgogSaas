import React from 'react';
import { Box, Chip, Avatar, Tooltip, Typography } from '@mui/material';
import { Users, Eye, Edit3, Clock } from 'lucide-react';
import { ActiveUser } from '../../graphql/queries/quoteCollaboration';
import { useTranslation } from 'react-i18next';

interface ActiveUsersProps {
  users: ActiveUser[];
  currentUserId: string;
}

/**
 * Displays active users viewing/editing a quote with presence indicators
 */
export const ActiveUsers: React.FC<ActiveUsersProps> = ({ users, currentUserId }) => {
  const { t } = useTranslation();

  if (users.length === 0) {
    return null;
  }

  // Filter out current user and sort by status
  const otherUsers = users
    .filter((user) => user.userId !== currentUserId)
    .sort((a, b) => {
      // EDITING users first, then VIEWING, then IDLE
      const statusOrder = { EDITING: 0, VIEWING: 1, IDLE: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

  const getUserColor = (userId: string): string => {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Light Salmon
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2', // Sky Blue
    ];
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getStatusIcon = (status: ActiveUser['status']) => {
    switch (status) {
      case 'EDITING':
        return <Edit3 size={12} />;
      case 'VIEWING':
        return <Eye size={12} />;
      case 'IDLE':
        return <Clock size={12} />;
    }
  };

  const getStatusColor = (status: ActiveUser['status']): string => {
    switch (status) {
      case 'EDITING':
        return '#4CAF50'; // Green
      case 'VIEWING':
        return '#2196F3'; // Blue
      case 'IDLE':
        return '#9E9E9E'; // Gray
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return t('collaboration.justNow');
    if (seconds < 3600) return t('collaboration.minutesAgo', { count: Math.floor(seconds / 60) });
    return t('collaboration.hoursAgo', { count: Math.floor(seconds / 3600) });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Users size={18} color="#666" />
      <Typography variant="body2" sx={{ color: '#666', mr: 1 }}>
        {t('collaboration.activeUsers', { count: otherUsers.length })}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {otherUsers.map((user) => (
          <Tooltip
            key={user.userId}
            title={
              <Box sx={{ p: 0.5 }}>
                <Typography variant="body2" fontWeight="bold">
                  {user.userName}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {user.userEmail}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  {getStatusIcon(user.status)}
                  <Typography variant="caption">
                    {t(`collaboration.status.${user.status.toLowerCase()}`)}
                  </Typography>
                </Box>
                {user.currentField && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                    {t('collaboration.editing')}: {user.currentField}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#999' }}>
                  {formatTimestamp(user.lastSeen)}
                </Typography>
              </Box>
            }
            arrow
          >
            <Chip
              avatar={
                <Avatar
                  sx={{
                    bgcolor: getUserColor(user.userId),
                    width: 24,
                    height: 24,
                    fontSize: '0.75rem',
                  }}
                >
                  {user.userName.charAt(0).toUpperCase()}
                </Avatar>
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{user.userName.split(' ')[0]}</span>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: getStatusColor(user.status),
                      ml: 0.5,
                    }}
                  />
                </Box>
              }
              size="small"
              sx={{
                height: 28,
                borderRadius: '14px',
                border: `2px solid ${getUserColor(user.userId)}`,
                bgcolor: 'white',
                '& .MuiChip-label': {
                  px: 1,
                },
              }}
            />
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};
