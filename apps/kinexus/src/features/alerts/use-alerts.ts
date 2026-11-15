import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/lib/auth';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { supabase } from '@/src/lib/supabase';
import { fetchAlerts, fetchUnreadAlertCount, type AlertRow } from '@/src/features/alerts/alerts-api';

function unreadKey(userId: string) {
  return ['alerts', 'unread', userId] as const;
}

function inboxKey(userId: string) {
  return ['alerts', 'inbox', userId] as const;
}

export function useAlertsUnreadCount() {
  const { user } = useAuth();
  const userId = user && !user.isDevBypass ? user.id : null;
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    return retainPostgresChannel(client, `alerts:${userId}`, (channel) =>
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_alerts', filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: unreadKey(userId) });
          void queryClient.invalidateQueries({ queryKey: inboxKey(userId) });
        },
      ),
    );
  }, [queryClient, userId]);

  return useQuery({
    queryKey: userId ? unreadKey(userId) : ['alerts', 'unread', 'none'],
    enabled: Boolean(userId && supabase),
    queryFn: fetchUnreadAlertCount,
    staleTime: 10_000,
  });
}

export function useAlertsInbox(limit = 60) {
  const { user } = useAuth();
  const userId = user && !user.isDevBypass ? user.id : null;

  return useQuery<AlertRow[]>({
    queryKey: userId ? inboxKey(userId) : ['alerts', 'inbox', 'none'],
    enabled: Boolean(userId && supabase),
    queryFn: () => fetchAlerts(limit),
    staleTime: 5_000,
  });
}

