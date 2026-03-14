import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';

// ── List sites for an org ──────────────────────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db
      .query('sites')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
  },
});

// ── Add site (admin only) ──────────────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin']);

    return await ctx.db.insert('sites', {
      orgId: args.orgId,
      name: args.name,
    });
  },
});

// ── Remove site (admin only) ───────────────────────────────────────

export const remove = mutation({
  args: { siteId: v.id('sites') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error('Site not found');

    await requireOrgRole(ctx, user._id as any, site.orgId as any, ['admin']);
    await ctx.db.delete(args.siteId);
  },
});
