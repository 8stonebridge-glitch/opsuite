import type { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Employee, OrgMode, OrgSettings, Site, Team } from '../types';

interface OrganizationListEntry {
  organization: {
    _id: string;
    name: string;
    industryId?: string | null;
    mode?: 'managed' | 'direct';
  };
  isActive: boolean;
}

interface ActiveOrganizationEntry {
  organization?: {
    _id: string;
    mode?: 'managed' | 'direct';
  } | null;
  settings?: Partial<OrgSettings> | null;
}

interface SiteEntry {
  _id: string;
  name: string;
}

interface TeamEntry {
  _id: string;
  name: string;
  color?: string | null;
  siteId?: string | null;
  subadminMembershipId?: string | null;
}

interface MembershipDirectoryEntry {
  membership: {
    _id: string;
    role: 'owner_admin' | 'subadmin' | 'employee';
    teamIds: string[];
  };
  user: {
    _id: string;
    name: string;
  };
}

export interface SyncedWorkspacePayload {
  id: string;
  orgName: string;
  industryId?: string | null;
  orgSettings?: OrgSettings;
  orgMode?: OrgMode;
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
      orgMode: entry.organization.mode || activeOrganization?.organization?.mode || 'managed',
    })),
  };
}

export async function waitForConvexIdentity(
  convex: ConvexReactClient,
  timeoutMs = 20000,
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
    'Your session is active, but Convex is still waiting for the auth token. If this keeps happening, confirm the Better Auth routes are live and try signing in again.'
  );
}

export function buildSyncedSites(sites: SiteEntry[]): Site[] {
  return sites.map((site) => ({
    id: String(site._id),
    name: site.name,
  }));
}

export function buildSyncedTeams(
  teams: TeamEntry[],
  memberships: MembershipDirectoryEntry[],
): Team[] {
  const membershipMap = new Map(memberships.map((entry) => [String(entry.membership._id), entry]));
  const syncedTeams: Team[] = [];

  for (const team of teams) {
    const leadEntry = team.subadminMembershipId
      ? membershipMap.get(String(team.subadminMembershipId))
      : undefined;

    // In managed mode, skip teams without a valid subadmin lead.
    // In direct mode, teams may not have a lead — use a placeholder.
    const lead: Employee = leadEntry && leadEntry.membership.role === 'subadmin'
      ? {
          id: String(leadEntry.user._id),
          name: leadEntry.user.name,
          role: 'subadmin',
          teamId: String(team._id),
          teamName: team.name,
        }
      : {
          // Placeholder lead for leadless teams (direct mode)
          id: '__no_lead__',
          name: 'Unassigned',
          role: 'admin',
          teamId: String(team._id),
          teamName: team.name,
        };

    // If no real lead and this isn't a leadless team (no members either), skip
    if (lead.id === '__no_lead__') {
      const hasMembers = memberships.some(
        (entry) =>
          entry.membership.role === 'employee' &&
          entry.membership.teamIds.map(String).includes(String(team._id)),
      );
      if (!hasMembers) continue;
    }

    const members: Employee[] = memberships
      .filter(
        (entry) =>
          entry.membership.role === 'employee' &&
          entry.membership.teamIds.map(String).includes(String(team._id)),
      )
      .map((entry) => ({
        id: String(entry.user._id),
        name: entry.user.name,
        role: 'employee' as const,
        teamId: String(team._id),
        teamName: team.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    syncedTeams.push({
      id: String(team._id),
      name: team.name,
      color: team.color || '#6b7280',
      siteId: team.siteId ? String(team.siteId) : undefined,
      lead,
      members,
    });
  }

  return syncedTeams.sort((a, b) => a.name.localeCompare(b.name));
}

/** Build standalone employees — members not attached to any team (direct/admin-only mode) */
export function buildStandaloneEmployees(
  memberships: MembershipDirectoryEntry[],
  teams: TeamEntry[],
): Employee[] {
  const teamIds = new Set(teams.map((t) => String(t._id)));
  return memberships
    .filter((entry) => {
      if (entry.membership.role === 'owner_admin') return false;
      // Employee is standalone if they have no teamIds or none of their teamIds exist
      const memberTeamIds = entry.membership.teamIds.map(String);
      return memberTeamIds.length === 0 || !memberTeamIds.some((tid) => teamIds.has(tid));
    })
    .map((entry) => ({
      id: String(entry.user._id),
      name: entry.user.name,
      role: entry.membership.role as 'employee' | 'subadmin',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
