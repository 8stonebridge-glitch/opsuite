import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { AppNotification } from '../../types';
import { useApp } from '../../store/AppContext';
import { buildNotificationsForRole } from '../../utils/notification-builder';

// ── Seen-state key helper ────────────────────────────────────────────

function stateKey(wsId: string, accountId: string): string {
  return `notif-${wsId}-${accountId}`;
}

// ── Context value ────────────────────────────────────────────────────

interface InboxContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  showInbox: boolean;
  openInbox: () => void;
  closeInbox: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  isRead: (id: string) => boolean;
}

const InboxContext = createContext<InboxContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function InboxProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();

  // Per-key sets of read and dismissed notification IDs
  const [readMap, setReadMap] = useState<Record<string, Set<string>>>({});
  const [dismissedMap, setDismissedMap] = useState<Record<string, Set<string>>>({});
  const [showInbox, setShowInbox] = useState(false);

  // Build notifications from current state
  const allNotifications = useMemo(() => {
    if (!state.isAuthenticated) return [];
    return buildNotificationsForRole(
      state.role,
      state.userId,
      state.tasks,
      state.audit,
      state.handoffs,
      state.availability,
      state.teams
    );
  }, [
    state.isAuthenticated,
    state.role,
    state.userId,
    state.tasks,
    state.audit,
    state.handoffs,
    state.availability,
    state.teams,
  ]);

  // Current key
  const key = state.currentAccountId
    ? stateKey(state.activeWorkspaceId, state.currentAccountId)
    : '';
  const readIds = key ? readMap[key] || new Set<string>() : new Set<string>();
  const dismissedIds = key ? dismissedMap[key] || new Set<string>() : new Set<string>();

  // Filter out dismissed notifications
  const notifications = useMemo(
    () => allNotifications.filter((n) => !dismissedIds.has(n.id)),
    [allNotifications, dismissedIds]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  const markRead = useCallback(
    (id: string) => {
      if (!key) return;
      setReadMap((prev) => {
        const existing = prev[key] || new Set<string>();
        if (existing.has(id)) return prev;
        const next = new Set(existing);
        next.add(id);
        return { ...prev, [key]: next };
      });
    },
    [key]
  );

  const dismiss = useCallback(
    (id: string) => {
      if (!key) return;
      setDismissedMap((prev) => {
        const existing = prev[key] || new Set<string>();
        const next = new Set(existing);
        next.add(id);
        return { ...prev, [key]: next };
      });
    },
    [key]
  );

  const isRead = useCallback(
    (id: string) => readIds.has(id),
    [readIds]
  );

  const openInbox = useCallback(() => {
    setShowInbox(true);
  }, []);

  const closeInbox = useCallback(() => {
    setShowInbox(false);
  }, []);

  const value = useMemo<InboxContextValue>(
    () => ({ notifications, unreadCount, showInbox, openInbox, closeInbox, markRead, dismiss, isRead }),
    [notifications, unreadCount, showInbox, openInbox, closeInbox, markRead, dismiss, isRead]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within InboxProvider');
  return ctx;
}
