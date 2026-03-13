import { useEffect, useRef } from 'react';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../store/AppContext';
import { useBackendAuth } from './BackendProviders';
import { buildSyncedWorkspaces, waitForConvexIdentity } from '../utils/backendSync';

export function ClerkSessionBridge() {
  const { state, dispatch } = useApp();
  const { clerkEnabled, isLoaded, isSignedIn, userId, email, fullName } = useBackendAuth();
  const convex = useConvex();
  const { isLoading: convexAuthLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();
  const syncFromClerk = useMutation(api.users.syncFromClerk);

  const viewer = useQuery(
    api.users.viewer,
    clerkEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated ? {} : 'skip'
  );
  const organizations = useQuery(
    api.organizations.listForViewer,
    clerkEnabled &&
      isLoaded &&
      isSignedIn &&
      !convexAuthLoading &&
      convexAuthenticated &&
      viewer?.user
      ? {}
      : 'skip'
  );
  const activeOrganization = useQuery(
    api.organizations.active,
    clerkEnabled &&
      isLoaded &&
      isSignedIn &&
      !convexAuthLoading &&
      convexAuthenticated &&
      viewer?.user
      ? {}
      : 'skip'
  );

  const lastSyncedUserId = useRef<string | null>(null);
  const lastAppliedSnapshot = useRef<string | null>(null);

  useEffect(() => {
    if (!clerkEnabled || !isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      lastSyncedUserId.current = null;
      lastAppliedSnapshot.current = null;

      if (state.isAuthenticated && !state.isDemo) {
        dispatch({ type: 'SIGN_OUT' });
      }
      return;
    }

    if (convexAuthLoading || !convexAuthenticated) {
      return;
    }

    if (viewer === undefined) {
      return;
    }

    if (!viewer?.user && lastSyncedUserId.current !== userId) {
      lastSyncedUserId.current = userId;
      void waitForConvexIdentity(convex)
        .then(() => syncFromClerk({}))
        .catch(() => {
          lastSyncedUserId.current = null;
        });
    }
  }, [
    clerkEnabled,
    convex,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    isLoaded,
    isSignedIn,
    state.isAuthenticated,
    state.isDemo,
    syncFromClerk,
    userId,
    viewer,
  ]);

  useEffect(() => {
    if (
      !clerkEnabled ||
      !isLoaded ||
      !isSignedIn ||
      !userId ||
      convexAuthLoading ||
      !convexAuthenticated ||
      !viewer?.user
    ) {
      return;
    }

    if (organizations === undefined || activeOrganization === undefined || !email) {
      return;
    }

    if (organizations.length === 0) {
      return;
    }

    const { activeWorkspaceId, workspaces } = buildSyncedWorkspaces(organizations, activeOrganization);

    const snapshot = JSON.stringify({
      userId,
      email,
      activeWorkspaceId,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        orgName: workspace.orgName,
        industryId: workspace.industryId,
        noChangeAlertWorkdays: workspace.orgSettings?.noChangeAlertWorkdays ?? null,
        reworkAlertCycles: workspace.orgSettings?.reworkAlertCycles ?? null,
      })),
    });

    if (lastAppliedSnapshot.current === snapshot) {
      return;
    }

    dispatch({
      type: 'SYNC_EXTERNAL_OWNER',
      clerkUserId: userId,
      name: fullName || viewer.user.name || 'Owner',
      email,
      workspaces,
      activeWorkspaceId: String(activeWorkspaceId),
    });
    lastAppliedSnapshot.current = snapshot;
  }, [
    activeOrganization,
    clerkEnabled,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    email,
    fullName,
    isLoaded,
    isSignedIn,
    organizations,
    userId,
    viewer,
  ]);

  return null;
}
