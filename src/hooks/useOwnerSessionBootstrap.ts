import { useMutation, useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../store/AppContext';
import { buildSyncedWorkspaces, waitForConvexIdentity } from '../utils/backendSync';

export function useOwnerSessionBootstrap() {
  const convex = useConvex();
  const { dispatch } = useApp();
  const syncFromAuth = useMutation(api.users.syncFromAuth);

  return async ({
    authUserId,
    name,
    email,
  }: {
    authUserId: string;
    name: string;
    email: string;
  }) => {
    await waitForConvexIdentity(convex);
    await syncFromAuth({});

    const [organizations, activeOrganization] = await Promise.all([
      convex.query(api.organizations.listForViewer, {}),
      convex.query(api.organizations.active, {}),
    ]);

    if (!organizations.length) {
      throw new Error('No organization access was found for this account yet.');
    }

    const { activeWorkspaceId, workspaces } = buildSyncedWorkspaces(organizations, activeOrganization);

    // Derive role from the active (or first) org membership so provisioned
    // employees/subadmins are routed correctly on first sign-in.
    const orgEntries = organizations as Array<{ organization: any; membership?: { role?: string }; isActive: boolean } | null>;
    const activeEntry = orgEntries.find((e) => e?.isActive) ?? orgEntries[0];
    const membershipRole = activeEntry?.membership?.role;
    const backendRole: 'admin' | 'subadmin' | 'employee' =
      membershipRole === 'owner_admin' ? 'admin'
      : membershipRole === 'subadmin' ? 'subadmin'
      : membershipRole === 'employee' ? 'employee'
      : 'admin';

    dispatch({
      type: 'SYNC_EXTERNAL_OWNER',
      authUserId,
      name,
      email,
      workspaces,
      activeWorkspaceId,
      backendRole,
    });
  };
}
