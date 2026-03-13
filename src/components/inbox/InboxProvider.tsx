import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { AppNotification } from '../../types';
import { useApp } from '../../store/AppContext';
import { buildNotificationsForRole } from '../../utils/notification-builder';
import { getNowISO } from '../../utils/date';

// ── Seen-state key helper ────────────────────────────────────────────

function notifSeenKey(wsId: string, accountId: string): string {
  return `notif-${wsId}-${accountId}`;
}

// ── Context value ────────────────────────────────────────────────────

interface InboxContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  seenAt: string;
  showInbox: boolean;
  openInbox: () => void;
  closeInbox: () => void;
}

const InboxContext = createContext<InboxContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function InboxProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();

  // seenAt map: key → ISO timestamp of last inbox open
  const [seenAtMap, setSeenAtMap] = useState<Record<string, string>>({});
  const [showInbox, setShowInbox] = useState(false);

  // Build notifications from current state
  const notifications = useMemo(() => {
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

  // Current seen key
  const seenKey = state.currentAccountId
    ? notifSeenKey(state.activeWorkspaceId, state.currentAccountId)
    : '';
  const seenAt = seenKey ? seenAtMap[seenKey] || '' : '';

  const unreadCount = useMemo(() => {
    if (!seenAt) return notifications.length;
    return notifications.filter((n) => n.timestamp > seenAt).length;
  }, [notifications, seenAt]);

  const openInbox = useCallback(() => {
    setShowInbox(true);
    if (seenKey) {
      setSeenAtMap((prev) => ({ ...prev, [seenKey]: getNowISO() }));
    }
  }, [seenKey]);

  const closeInbox = useCallback(() => {
    setShowInbox(false);
  }, []);

  const value = useMemo<InboxContextValue>(
    () => ({ notifications, unreadCount, seenAt, showInbox, openInbox, closeInbox }),
    [notifications, unreadCount, seenAt, showInbox, openInbox, closeInbox]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within InboxProvider');
  return ctx;
}
