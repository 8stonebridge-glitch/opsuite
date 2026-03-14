import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';

// ── List categories for an org ─────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db
      .query('categories')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
  },
});

// ── Create category (admin only) ───────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin']);

    return await ctx.db.insert('categories', {
      orgId: args.orgId,
      name: args.name,
    });
  },
});

// ── Batch set categories (admin only — for onboarding) ─────────────

export const batchSet = mutation({
  args: {
    orgId: v.id('organizations'),
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin']);

    // Delete existing
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
    for (const cat of existing) {
      await ctx.db.delete(cat._id);
    }

    // Insert new
    const ids = [];
    for (const name of args.names) {
      const id = await ctx.db.insert('categories', {
        orgId: args.orgId,
        name,
      });
      ids.push(id);
    }
    return ids;
  },
});
