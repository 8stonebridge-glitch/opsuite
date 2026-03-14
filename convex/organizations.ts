import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser } from './helpers';
import { getNowISO } from './shared';

// ── Create organization ────────────────────────────────────────────

export const create = mutation({
  args: {
    name: v.string(),
    industry: v.object({
      id: v.string(),
      name: v.string(),
      sitesLabel: v.string(),
      color: v.string(),
    }),
    orgStructure: v.union(v.literal('with_subadmins'), v.literal('admin_only')),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);

    const orgId = await ctx.db.insert('organizations', {
      name: args.name,
      industry: args.industry,
      orgStructure: args.orgStructure,
      settings: { noChangeAlertWorkdays: 3, reworkAlertCycles: 3 },
      createdBy: user._id,
      createdAt: getNowISO(),
    });

    // Auto-create admin membership for creator
    await ctx.db.insert('memberships', {
      userId: user._id,
      orgId,
      role: 'admin',
      isActive: true,
      joinedAt: getNowISO(),
    });

    return orgId;
  },
});

// ── List orgs the current user belongs to ──────────────────────────

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await getAuthUser(ctx);

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.orgId);
        return org ? { ...org, memberRole: m.role } : null;
      })
    );

    return orgs.filter(Boolean);
  },
});

// ── Get single org (with membership check) ─────────────────────────

export const get = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', args.orgId)
      )
      .unique();

    if (!membership || !membership.isActive) {
      throw new Error('Not a member of this organization');
    }

    const org = await ctx.db.get(args.orgId);
    return org ? { ...org, memberRole: membership.role } : null;
  },
});

// ── Update org settings ────────────────────────────────────────────

export const updateSettings = mutation({
  args: {
    orgId: v.id('organizations'),
    settings: v.object({
      noChangeAlertWorkdays: v.number(),
      reworkAlertCycles: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);

    // Only admins can change settings
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', args.orgId)
      )
      .unique();

    if (!membership || membership.role !== 'admin') {
      throw new Error('Only admins can update organization settings');
    }

    await ctx.db.patch(args.orgId, { settings: args.settings });
  },
});
