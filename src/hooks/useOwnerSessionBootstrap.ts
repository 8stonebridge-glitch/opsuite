import { useMutation, useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useApp } from '../store/AppContext';
import { buildSyncedWorkspaces, waitForConvexIdentity } from '../utils/backendSync';

export function useOwnerSessionBootstrap() {
  const convex = useConvex();
  const { dispatch } = useApp();
  const syncFromClerk = useMutation(api.users.syncFromClerk);

  return async ({
    clerkUserId,
    name,
    email,
  }: {
    clerkUserId: string;
    name: string;
    email: string;
  }) => {
    await waitForConvexIdentity(convex);
    await syncFromClerk({});

    const [organizations, activeOrganization] = await Promise.all([
      convex.query(api.organizations.listForViewer, {}),
      convex.query(api.organizations.active, {}),
    ]);

    if (!organizations.length) {
      throw new Error('No organization access was found for this account yet.');
    }

    const { activeWorkspaceId, workspaces } = buildSyncedWorkspaces(organizations, activeOrganization);

    dispatch({
      type: 'SYNC_EXTERNAL_OWNER',
      clerkUserId,
      name,
      email,
      workspaces,
      activeWorkspaceId,
    });
  };
}
