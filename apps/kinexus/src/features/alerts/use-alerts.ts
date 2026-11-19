import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/src/lib/auth';
import { retainPostgresChannel } from '@/src/lib/realtime';
import { supabase } from '@/src/lib/supabase';
import { fetchAlerts, fetchUnreadAlertCount, type AlertRow } from '@/src/features/alerts/alerts-api';
import type { AlertScope } from '@/src/features/alerts/segments';

function unreadKey(userId: string, scope: AlertScope) {
  return ['alerts', 'unread', scope, userId] as const;
}

function inboxKey(userId: string, scope: AlertScope) {
  return ['alerts', 'inbox', scope, userId] as const;
}

function useAlertsRealtime(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) return;
    return retainPostgresChannel(client, `alerts:${userId}`, (channel) =>
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_alerts', filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['alerts', 'unread'] });
          void queryClient.invalidateQueries({ queryKey: ['alerts', 'inbox'] });
        },
      ),
    );
  }, [queryClient, userId]);
}

export function useAlertsUnreadCount(scope: AlertScope = 'household', enabled = true) {
  const { user } = useAuth();
  const userId = user && !user.isDevBypass ? user.id : null;
  const active = Boolean(enabled && userId && supabase);
  useAlertsRealtime(active ? userId : null);

  return useQuery({
    queryKey: userId ? unreadKey(userId, scope) : ['alerts', 'unread', scope, 'none'],
    enabled: active,
    queryFn: () => fetchUnreadAlertCount(scope),
    staleTime: 10_000,
  });
}

export function useAlertsInbox(limit = 60, scope: AlertScope = 'household', enabled = true) {
  const { user } = useAuth();
  const userId = user && !user.isDevBypass ? user.id : null;

  return useQuery<AlertRow[]>({
    queryKey: userId ? inboxKey(userId, scope) : ['alerts', 'inbox', scope, 'none'],
    enabled: Boolean(enabled && userId && supabase),
    queryFn: () => fetchAlerts(limit, scope),
    staleTime: 5_000,
  });
}
