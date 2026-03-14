import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';

// ── List check-ins for an org ──────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db
      .query('checkIns')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
  },
});

// ── Create check-in ────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    userId: v.string(),
    date: v.string(),
    time: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    // Employees can only check in for themselves
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', args.orgId)
      )
      .unique();

    if (membership?.role === 'employee' && args.userId !== (user._id as string)) {
      throw new Error('Employees can only check in for themselves');
    }

    return await ctx.db.insert('checkIns', {
      orgId: args.orgId,
      userId: args.userId,
      date: args.date,
      time: args.time,
      note: args.note,
    });
  },
});
