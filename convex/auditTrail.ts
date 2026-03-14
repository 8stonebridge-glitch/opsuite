import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';
import { getNowISO, getTodayISO } from './shared';

// ── List audit entries for an org ──────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db
      .query('audit')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
  },
});

// ── List audit entries for a specific task ─────────────────────────

export const listByTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);

    const entries = await ctx.db
      .query('audit')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .collect();

    // Verify the user has access to this task's org
    if (entries.length > 0) {
      await requireOrgRole(ctx, user._id as any, entries[0].orgId as any, ['admin', 'subadmin', 'employee']);
    }

    return entries;
  },
});

// ── Add audit entry ────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    taskId: v.optional(v.string()),
    role: v.string(),
    message: v.string(),
    updateType: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db.insert('audit', {
      orgId: args.orgId,
      taskId: args.taskId,
      role: args.role,
      message: args.message,
      createdAt: getNowISO(),
      dateTag: getTodayISO(),
      updateType: args.updateType,
    });
  },
});
