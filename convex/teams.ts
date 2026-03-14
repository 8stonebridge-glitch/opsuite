import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';

// ── List teams for an org ──────────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();

    // Enrich with members
    return Promise.all(
      teams.map(async (team) => {
        const members = await ctx.db
          .query('teamMembers')
          .withIndex('by_team', (q) => q.eq('teamId', team._id))
          .collect();

        const lead = await ctx.db.get(team.leadUserId);

        const enrichedMembers = await Promise.all(
          members.map(async (m) => {
            const memberUser = await ctx.db.get(m.userId);
            return {
              id: m.userId,
              name: memberUser?.name || 'Unknown',
              role: 'employee' as const,
              teamId: team._id,
              teamName: team.name,
            };
          })
        );

        return {
          id: team._id,
          name: team.name,
          color: team.color,
          lead: {
            id: team.leadUserId,
            name: lead?.name || 'Unknown',
            role: 'subadmin' as const,
            teamId: team._id,
            teamName: team.name,
          },
          members: enrichedMembers,
        };
      })
    );
  },
});

// ── Create team (admin only) ───────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    name: v.string(),
    color: v.string(),
    leadUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin']);

    return await ctx.db.insert('teams', {
      orgId: args.orgId,
      name: args.name,
      color: args.color,
      leadUserId: args.leadUserId,
    });
  },
});

// ── Add member to team (admin or subadmin lead) ────────────────────

export const addMember = mutation({
  args: {
    teamId: v.id('teams'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team) throw new Error('Team not found');

    // Admin or the team's lead can add members
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', team.orgId)
      )
      .unique();

    if (!membership) throw new Error('Not a member of this organization');
    const isAdmin = membership.role === 'admin';
    const isTeamLead = team.leadUserId === user._id;
    if (!isAdmin && !isTeamLead) {
      throw new Error('Only admins or team leads can add team members');
    }

    return await ctx.db.insert('teamMembers', {
      teamId: args.teamId,
      userId: args.userId,
      orgId: team.orgId,
    });
  },
});

// ── Remove member from team ────────────────────────────────────────

export const removeMember = mutation({
  args: { teamMemberId: v.id('teamMembers') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const tm = await ctx.db.get(args.teamMemberId);
    if (!tm) throw new Error('Team member not found');

    const team = await ctx.db.get(tm.teamId);
    if (!team) throw new Error('Team not found');

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', team.orgId)
      )
      .unique();

    if (!membership) throw new Error('Not a member of this organization');
    const isAdmin = membership.role === 'admin';
    const isTeamLead = team.leadUserId === user._id;
    if (!isAdmin && !isTeamLead) {
      throw new Error('Only admins or team leads can remove team members');
    }

    await ctx.db.delete(args.teamMemberId);
  },
});
