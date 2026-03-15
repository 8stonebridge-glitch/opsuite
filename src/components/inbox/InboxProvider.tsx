import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import type { AppNotification } from '../../types';
import { useApp } from '../../store/AppContext';
import { api } from '../../../convex/_generated/api';
import { useBackendAuth } from '../../providers/BackendProviders';

// ── Context value ────────────────────────────────────────────────────

interface InboxContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  showInbox: boolean;
  openInbox: () => void;
  closeInbox: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  isRead: (id: string) => boolean;
}

const InboxContext = createContext<InboxContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function InboxProvider({ children }: { children: ReactNode }) {
  const { state } = useApp();
  const { authEnabled, isSignedIn } = useBackendAuth();
  const [showInbox, setShowInbox] = useState(false);

  // Only fetch notifications when user is fully authenticated AND has completed
  // session bridging (isAuthenticated in local state). This prevents crashes when
  // Clerk has a stale session but the user record doesn't exist in Convex yet.
  const isFullyReady = authEnabled && isSignedIn && state.isAuthenticated;
  const serverNotifications = useQuery(
    api.notifications.listForUser,
    isFullyReady ? {} : 'skip'
  );

  const markReadMutation = useMutation(api.notifications.markRead);
  const markAllReadMutation = useMutation(api.notifications.markAllRead);
  const dismissMutation = useMutation(api.notifications.dismiss);

  // Map Convex objects to AppNotification interface expected by UI
  const notifications = useMemo(() => {
    if (!serverNotifications) return [];
    return serverNotifications.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: n.body,
      type: n.type as AppNotification['type'],
      timestamp: n.createdAt,
      taskId: n.taskId ? String(n.taskId) : undefined,
      route: n.route,
      isRead: n.isRead,
      isDismissed: n.isDismissed,
    }));
  }, [serverNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const markRead = useCallback(
    (id: string) => {
      // Optimistically update if needed, but Convex handles that mostly automatically
      // We pass the Convex `Id` directly since `n.id` is just `String(n._id)`
      markReadMutation({ notificationId: id as any }).catch(console.error);
    },
    [markReadMutation]
  );

  const dismiss = useCallback(
    (id: string) => {
      dismissMutation({ notificationId: id as any }).catch(console.error);
    },
    [dismissMutation]
  );

  const markAllRead = useCallback(() => {
    markAllReadMutation().catch(console.error);
  }, [markAllReadMutation]);

  const isRead = useCallback(
    (id: string) => {
      const notif = notifications.find((n) => n.id === id);
      return notif ? notif.isRead : false;
    },
    [notifications]
  );

  const openInbox = useCallback(() => setShowInbox(true), []);
  const closeInbox = useCallback(() => setShowInbox(false), []);

  const value = useMemo<InboxContextValue>(
    () => ({ notifications, unreadCount, showInbox, openInbox, closeInbox, markRead, markAllRead, dismiss, isRead }),
    [notifications, unreadCount, showInbox, openInbox, closeInbox, markRead, markAllRead, dismiss, isRead]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within InboxProvider');
  return ctx;
}
