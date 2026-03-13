import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { OrgSettings } from '../types';

interface OrganizationListEntry {
  organization: {
    _id: string;
    name: string;
    industryId?: string | null;
  };
  isActive: boolean;
}

interface ActiveOrganizationEntry {
  organization?: {
    _id: string;
  } | null;
  settings?: Partial<OrgSettings> | null;
}

export interface SyncedWorkspacePayload {
  id: string;
  orgName: string;
  industryId?: string | null;
  orgSettings?: OrgSettings;
}

export function defaultOrgSettings(settings?: Partial<OrgSettings> | null): OrgSettings {
  return {
    noChangeAlertWorkdays: settings?.noChangeAlertWorkdays ?? 3,
    reworkAlertCycles: settings?.reworkAlertCycles ?? 3,
  };
}

export function buildSyncedWorkspaces(
  organizations: Array<OrganizationListEntry | null>,
  activeOrganization?: ActiveOrganizationEntry | null
): {
  activeWorkspaceId: string;
  workspaces: SyncedWorkspacePayload[];
} {
  const validOrganizations = organizations.filter((entry): entry is OrganizationListEntry => Boolean(entry));
  const activeWorkspaceId =
    String(validOrganizations.find((entry) => entry.isActive)?.organization._id || '') ||
    String(activeOrganization?.organization?._id || '') ||
    String(validOrganizations[0]?.organization._id || '');

  return {
    activeWorkspaceId,
    workspaces: validOrganizations.map((entry) => ({
      id: String(entry.organization._id),
      orgName: entry.organization.name,
      industryId: entry.organization.industryId ?? null,
      orgSettings:
        String(entry.organization._id) === activeWorkspaceId
          ? defaultOrgSettings(activeOrganization?.settings)
          : undefined,
    })),
  };
}

export async function waitForConvexIdentity(
  convex: ConvexReactClient,
  timeoutMs = 8000,
  pollMs = 250
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const viewer = await convex.query(api.users.viewer, {});
    if (viewer?.identity) {
      return viewer;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    'Clerk signed in, but Convex auth is not ready yet. Check that the Clerk JWT template named "convex" is configured correctly.'
  );
}
