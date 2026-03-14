import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';
import { getNowISO } from './shared';

// ── List members of an org ─────────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);

    // Must be a member to see other members
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    // Enrich with user data
    return Promise.all(
      memberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          ...m,
          userName: memberUser?.name || 'Unknown',
          userEmail: memberUser?.email || '',
        };
      })
    );
  },
});

// ── Add member (admin only) ────────────────────────────────────────

export const addMember = mutation({
  args: {
    orgId: v.id('organizations'),
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('subadmin'), v.literal('employee')),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin']);

    // Check if membership already exists
    const existing = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', args.userId).eq('orgId', args.orgId)
      )
      .unique();

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        await ctx.db.patch(existing._id, {
          isActive: true,
          role: args.role,
          teamId: args.teamId,
        });
        return existing._id;
      }
      throw new Error('User is already a member of this organization');
    }

    return await ctx.db.insert('memberships', {
      userId: args.userId,
      orgId: args.orgId,
      role: args.role,
      teamId: args.teamId,
      isActive: true,
      joinedAt: getNowISO(),
    });
  },
});

// ── Update member role (admin only) ────────────────────────────────

export const updateRole = mutation({
  args: {
    membershipId: v.id('memberships'),
    role: v.union(v.literal('admin'), v.literal('subadmin'), v.literal('employee')),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error('Membership not found');

    await requireOrgRole(ctx, user._id as any, membership.orgId as any, ['admin']);
    await ctx.db.patch(args.membershipId, { role: args.role });
  },
});

// ── Remove member (admin only) ─────────────────────────────────────

export const removeMember = mutation({
  args: { membershipId: v.id('memberships') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error('Membership not found');

    await requireOrgRole(ctx, user._id as any, membership.orgId as any, ['admin']);

    // Soft-delete: deactivate instead of hard delete
    await ctx.db.patch(args.membershipId, { isActive: false });
  },
});
