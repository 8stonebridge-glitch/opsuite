import { useEffect, useRef } from 'react';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../store/AppContext';
import { useBackendAuth } from './BackendProviders';
import {
  buildSyncedSites,
  buildSyncedTeams,
  buildStandaloneEmployees,
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
  const taskFeed = useQuery(
    api.tasks.listForCurrentScope,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );
  const availability = useQuery(
    api.availability.listForCurrentScope,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );
  const handoffFeed = useQuery(
    api.handoffs.listForCurrentScope,
    authEnabled && isLoaded && isSignedIn && !convexAuthLoading && convexAuthenticated && viewer?.user ? {} : 'skip'
  );

  const setActiveOrganization = useMutation(api.users.setActiveOrganization);

  const lastSyncedUserId = useRef<string | null>(null);
  const lastAppliedSnapshot = useRef<string | null>(null);
  const autoSwitchAttempted = useRef(false);

  useEffect(() => {
    if (!authEnabled || !isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      lastSyncedUserId.current = null;
      lastAppliedSnapshot.current = null;
      autoSwitchAttempted.current = false;

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

  // Auto-switch: if activeOrganization is null but user has orgs, their
  // activeOrganizationId is stale — reset to their owned org on the backend.
  useEffect(() => {
    if (!authEnabled || !isLoaded || !isSignedIn || convexAuthLoading || !convexAuthenticated || !viewer?.user) {
      return;
    }
    if (organizations === undefined || activeOrganization === undefined) {
      return;
    }
    if (activeOrganization !== null || organizations.length === 0 || autoSwitchAttempted.current) {
      return;
    }
    // activeOrganization is null but user has orgs — pick the owned one
    const owned = organizations.find(
      (entry) => entry && entry.membership.role === 'owner_admin',
    );
    const fallback = owned || organizations[0];
    if (fallback?.organization?._id) {
      autoSwitchAttempted.current = true;
      void setActiveOrganization({
        organizationId: fallback.organization._id as any,
      }).catch(() => {
        autoSwitchAttempted.current = false;
      });
    }
  }, [
    activeOrganization,
    authEnabled,
    convexAuthenticated,
    convexAuthLoading,
    isLoaded,
    isSignedIn,
    organizations,
    setActiveOrganization,
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
      // User is authenticated but has no organization yet — sign them in
      // locally so they leave the loading screen and can be routed to
      // onboarding / org creation.
      if (!state.isAuthenticated) {
        dispatch({
          type: 'SYNC_EXTERNAL_OWNER',
          authUserId: userId,
          name: fullName || viewer.user.name || 'Owner',
          email,
          workspaces: [],
          activeWorkspaceId: '',
        });
      }
      return;
    }

    const { activeWorkspaceId, workspaces } = buildSyncedWorkspaces(organizations, activeOrganization);

    // Derive the user's role and Convex userId from the active membership
    const activeMembershipRole = activeOrganization?.membership?.role;
    const convexUserId = viewer.user?._id ? String(viewer.user._id) : null;
    const mappedRole: 'admin' | 'subadmin' | 'employee' =
      activeMembershipRole === 'owner_admin' ? 'admin'
      : activeMembershipRole === 'subadmin' ? 'subadmin'
      : activeMembershipRole === 'employee' ? 'employee'
      : 'admin';

    const snapshot = JSON.stringify({
      userId,
      email,
      activeWorkspaceId,
      convexUserId,
      mappedRole,
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
      backendRole: mappedRole,
      backendUserId: convexUserId,
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
    state.isAuthenticated,
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

    const orgMode = activeOrganization?.organization?.mode === 'direct' ? 'direct' as const : 'managed' as const;

    dispatch({
      type: 'SYNC_EXTERNAL_ACTIVE_STRUCTURE',
      workspaceId: activeWorkspaceId,
      sites: buildSyncedSites(sites as never),
      teams: buildSyncedTeams(teams as never, memberships as never),
      standaloneEmployees: buildStandaloneEmployees(memberships as never, teams as never, sites as never),
      orgMode,
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

  useEffect(() => {
    if (!authEnabled || !isLoaded || !isSignedIn || convexAuthLoading || !convexAuthenticated || !viewer?.user || taskFeed === undefined) {
      return;
    }

    dispatch({
      type: 'SET_TASKS',
      tasks: taskFeed.scopedTasks,
    });
    dispatch({
      type: 'SET_AUDIT',
      entries: taskFeed.auditEntries,
    });
  }, [
    authEnabled,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    isLoaded,
    isSignedIn,
    taskFeed,
    viewer,
  ]);

  useEffect(() => {
    if (!authEnabled || !isLoaded || !isSignedIn || convexAuthLoading || !convexAuthenticated || !viewer?.user || availability === undefined) {
      return;
    }

    dispatch({
      type: 'SET_AVAILABILITY',
      availability,
    });
  }, [
    authEnabled,
    availability,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    isLoaded,
    isSignedIn,
    viewer,
  ]);

  useEffect(() => {
    if (!authEnabled || !isLoaded || !isSignedIn || convexAuthLoading || !convexAuthenticated || !viewer?.user || handoffFeed === undefined) {
      return;
    }

    dispatch({
      type: 'SET_HANDOFFS',
      handoffs: handoffFeed.handoffs,
    });
    dispatch({
      type: 'SET_CHECKINS',
      checkIns: handoffFeed.checkIns,
    });
  }, [
    authEnabled,
    convexAuthenticated,
    convexAuthLoading,
    dispatch,
    handoffFeed,
    isLoaded,
    isSignedIn,
    viewer,
  ]);

  return null;
}
