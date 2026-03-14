import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';
import { getNowISO } from './shared';

// ── List handoffs for an org ───────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db
      .query('handoffs')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
  },
});

// ── Create handoff ─────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    userId: v.string(),
    date: v.string(),
    tasks: v.array(
      v.object({
        taskId: v.string(),
        status: v.string(),
        note: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    // Users can only create handoffs for themselves (unless admin)
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', args.orgId)
      )
      .unique();

    if (membership?.role === 'employee' && args.userId !== (user._id as string)) {
      throw new Error('Employees can only create their own handoffs');
    }

    return await ctx.db.insert('handoffs', {
      orgId: args.orgId,
      userId: args.userId,
      date: args.date,
      tasks: args.tasks,
      createdAt: getNowISO(),
    });
  },
});
