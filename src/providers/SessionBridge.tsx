import { useEffect, useRef } from 'react';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../store/AppContext';
import { useBackendAuth } from './BackendProviders';
import {
  buildSyncedSites,
  buildSyncedTeams,
  buildSyncedWorkspaces,
  waitForConvexIdentity,
} from '../utils/backendSync';

export function SessionBridge() {
  const { state, dispatch } = useApp();
  const { authEnabled, isLoaded, isSignedIn, userId, email, fullName } = useBackendAuth();
  const convex = useConvex();
  const { isLoading: convexAuthLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();
  const syncFromAuth = useMutation(api.users.syncFromAuth);

  const viewer = useQuery(
    api.users.viewer,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated ? {} : 'skip'
  );
  const organizations = useQuery(
    api.organizations.listForViewer,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );
  const activeOrganization = useQuery(
    api.organizations.active,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );
  const sites = useQuery(
    api.sites.listForActiveOrganization,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );
  const memberships = useQuery(
    api.memberships.listForActiveOrganization,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );
  const teams = useQuery(
    api.teams.listForActiveOrganization,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );

  const lastSyncedUserId = useRef<string | null>(null);
  const lastAppliedSnapshot = useRef<string | null>(null);

  useEffect(() => {
    if (!authEnabled || !isLoaded) {
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
        .then(() => syncFromAuth({}))
        .catch(() => {
          lastSyncedUserId.current = null;
        });
    }
  }, [
    authEnabled,
    convex,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    isLoaded,
    isSignedIn,
    state.isAuthenticated,
    state.isDemo,
    syncFromAuth,
    userId,
    viewer,
  ]);

  useEffect(() => {
    if (!authEnabled || !isLoaded || !isSignedIn || !userId || convexAuthLoading || !convexAuthenticated || !viewer?.user) {
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
      authUserId: userId,
      name: fullName || viewer.user.name || 'Owner',
      email,
      workspaces,
      activeWorkspaceId: String(activeWorkspaceId),
    });
    lastAppliedSnapshot.current = snapshot;
  }, [
    activeOrganization,
    authEnabled,
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

  useEffect(() => {
    if (!authEnabled || !isLoaded || !isSignedIn || convexAuthLoading || !convexAuthenticated || !viewer?.user || organizations === undefined || activeOrganization === undefined || sites === undefined || memberships === undefined || teams === undefined) {
      return;
    }

    const activeWorkspaceId =
      String(activeOrganization?.organization?._id || '') ||
      String(organizations.find((entry) => entry?.isActive)?.organization._id || '');

    if (!activeWorkspaceId) {
      return;
    }

    dispatch({
      type: 'SYNC_EXTERNAL_ACTIVE_STRUCTURE',
      workspaceId: activeWorkspaceId,
      sites: buildSyncedSites(sites as never),
      teams: buildSyncedTeams(teams as never, memberships as never),
    });
  }, [
    activeOrganization,
    authEnabled,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    isLoaded,
    isSignedIn,
    memberships,
    organizations,
    sites,
    teams,
    viewer,
  ]);

  return null;
}
