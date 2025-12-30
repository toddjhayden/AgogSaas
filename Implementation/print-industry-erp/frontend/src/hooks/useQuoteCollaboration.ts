import { useEffect, useRef, useCallback, useState } from 'react';
import { useMutation, useSubscription } from '@apollo/client';
import {
  JOIN_QUOTE_SESSION,
  LEAVE_QUOTE_SESSION,
  UPDATE_SESSION_HEARTBEAT,
  PRESENCE_UPDATED_SUBSCRIPTION,
  QUOTE_CHANGED_SUBSCRIPTION,
  QUOTE_LINE_CHANGED_SUBSCRIPTION,
  ActiveUser,
  QuoteChangedEvent,
  QuoteLineChangedEvent,
} from '../graphql/queries/quoteCollaboration';

interface UseQuoteCollaborationProps {
  quoteId: string;
  userId: string;
  userName: string;
  userEmail: string;
  onQuoteChanged?: (event: QuoteChangedEvent) => void;
  onQuoteLineChanged?: (event: QuoteLineChangedEvent) => void;
  onPresenceUpdated?: (activeUsers: ActiveUser[]) => void;
}

interface UseQuoteCollaborationReturn {
  activeUsers: ActiveUser[];
  sessionId: string | null;
  isConnected: boolean;
  updateCursorPosition: (lineId?: string, field?: string, position?: number) => void;
  setEditingStatus: (isEditing: boolean) => void;
}

/**
 * Hook for managing quote collaboration features:
 * - Presence tracking (who's viewing/editing)
 * - Real-time quote updates
 * - Heartbeat mechanism
 * - Cursor position tracking
 */
export const useQuoteCollaboration = ({
  quoteId,
  userId,
  userName,
  userEmail,
  onQuoteChanged,
  onQuoteLineChanged,
  onPresenceUpdated,
}: UseQuoteCollaborationProps): UseQuoteCollaborationReturn => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mutations
  const [joinSession] = useMutation(JOIN_QUOTE_SESSION);
  const [leaveSession] = useMutation(LEAVE_QUOTE_SESSION);
  const [updateHeartbeat] = useMutation(UPDATE_SESSION_HEARTBEAT);

  // Subscriptions
  const { data: presenceData } = useSubscription(PRESENCE_UPDATED_SUBSCRIPTION, {
    variables: { quoteId },
    skip: !quoteId,
    onData: ({ data }) => {
      if (data?.data?.presenceUpdated) {
        const users = data.data.presenceUpdated.activeUsers;
        setActiveUsers(users);
        onPresenceUpdated?.(users);
      }
    },
  });

  const { data: quoteChangedData } = useSubscription(QUOTE_CHANGED_SUBSCRIPTION, {
    variables: { quoteId },
    skip: !quoteId,
    onData: ({ data }) => {
      if (data?.data?.quoteChanged) {
        onQuoteChanged?.(data.data.quoteChanged);
      }
    },
  });

  const { data: quoteLineChangedData } = useSubscription(QUOTE_LINE_CHANGED_SUBSCRIPTION, {
    variables: { quoteId },
    skip: !quoteId,
    onData: ({ data }) => {
      if (data?.data?.quoteLineChanged) {
        onQuoteLineChanged?.(data.data.quoteLineChanged);
      }
    },
  });

  /**
   * Join the quote editing session
   */
  const joinQuoteSession = useCallback(async () => {
    try {
      const { data } = await joinSession({
        variables: {
          input: {
            quoteId,
            userId,
            userName,
            userEmail,
          },
        },
      });

      if (data?.joinQuoteSession) {
        setSessionId(data.joinQuoteSession.sessionId);
        setIsConnected(true);
        console.log('Joined quote session:', data.joinQuoteSession.sessionId);
      }
    } catch (error) {
      console.error('Failed to join quote session:', error);
      setIsConnected(false);
    }
  }, [joinSession, quoteId, userId, userName, userEmail]);

  /**
   * Leave the quote editing session
   */
  const leaveQuoteSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await leaveSession({
        variables: { sessionId },
      });
      console.log('Left quote session:', sessionId);
    } catch (error) {
      console.error('Failed to leave quote session:', error);
    } finally {
      setSessionId(null);
      setIsConnected(false);
    }
  }, [leaveSession, sessionId]);

  /**
   * Send heartbeat to keep session alive
   */
  const sendHeartbeat = useCallback(async () => {
    if (!sessionId) return;

    try {
      await updateHeartbeat({
        variables: {
          input: {
            sessionId,
            status: 'VIEWING',
          },
        },
      });
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }, [updateHeartbeat, sessionId]);

  /**
   * Update cursor position
   */
  const updateCursorPosition = useCallback(
    async (lineId?: string, field?: string, position?: number) => {
      if (!sessionId) return;

      try {
        await updateHeartbeat({
          variables: {
            input: {
              sessionId,
              currentLineId: lineId,
              currentField: field,
              cursorPosition: position,
              status: 'EDITING',
            },
          },
        });
      } catch (error) {
        console.error('Failed to update cursor position:', error);
      }
    },
    [updateHeartbeat, sessionId]
  );

  /**
   * Set editing status (VIEWING/EDITING/IDLE)
   */
  const setEditingStatus = useCallback(
    async (isEditing: boolean) => {
      if (!sessionId) return;

      try {
        await updateHeartbeat({
          variables: {
            input: {
              sessionId,
              isEditing,
              status: isEditing ? 'EDITING' : 'VIEWING',
            },
          },
        });
      } catch (error) {
        console.error('Failed to update editing status:', error);
      }
    },
    [updateHeartbeat, sessionId]
  );

  /**
   * Join session on mount
   */
  useEffect(() => {
    if (quoteId && userId) {
      joinQuoteSession();
    }

    return () => {
      leaveQuoteSession();
    };
  }, [quoteId, userId]); // Intentionally omit joinQuoteSession/leaveQuoteSession to avoid re-joining

  /**
   * Setup heartbeat interval (every 10 seconds)
   */
  useEffect(() => {
    if (sessionId) {
      // Send initial heartbeat
      sendHeartbeat();

      // Setup interval for subsequent heartbeats
      heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat();
      }, 10000); // 10 seconds

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      };
    }
  }, [sessionId, sendHeartbeat]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  return {
    activeUsers,
    sessionId,
    isConnected,
    updateCursorPosition,
    setEditingStatus,
  };
};
