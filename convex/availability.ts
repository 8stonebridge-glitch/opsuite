import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';
import { getNowISO } from './shared';

// ── List availability records for an org ───────────────────────────

export const listByOrg = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    return await ctx.db
      .query('availability')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();
  },
});

// ── Request leave/sick/off_duty ────────────────────────────────────

export const request = mutation({
  args: {
    orgId: v.id('organizations'),
    userId: v.string(),
    type: v.union(v.literal('leave'), v.literal('sick'), v.literal('off_duty')),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin', 'employee']);

    // Employees can only request for themselves
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', args.orgId)
      )
      .unique();

    if (membership?.role === 'employee' && args.userId !== (user._id as string)) {
      throw new Error('Employees can only request availability for themselves');
    }

    return await ctx.db.insert('availability', {
      orgId: args.orgId,
      userId: args.userId,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status: 'pending',
      createdAt: getNowISO(),
    });
  },
});

// ── Approve availability (admin or subadmin) ───────────────────────

export const approve = mutation({
  args: { recordId: v.id('availability') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error('Record not found');

    await requireOrgRole(ctx, user._id as any, record.orgId as any, ['admin', 'subadmin']);

    if (record.status !== 'pending') {
      throw new Error('Can only approve pending requests');
    }

    await ctx.db.patch(args.recordId, {
      status: 'approved',
      approvedById: user._id as string,
      approvedAt: getNowISO(),
    });
  },
});

// ── Reject availability (admin or subadmin) ────────────────────────

export const reject = mutation({
  args: { recordId: v.id('availability') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error('Record not found');

    await requireOrgRole(ctx, user._id as any, record.orgId as any, ['admin', 'subadmin']);

    if (record.status !== 'pending') {
      throw new Error('Can only reject pending requests');
    }

    await ctx.db.patch(args.recordId, {
      status: 'rejected',
      approvedById: user._id as string,
      approvedAt: getNowISO(),
    });
  },
});

// ── Cancel availability (own request only) ─────────────────────────

export const cancel = mutation({
  args: { recordId: v.id('availability') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const record = await ctx.db.get(args.recordId);
    if (!record) throw new Error('Record not found');

    // Only the requester or an admin can cancel
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', record.orgId)
      )
      .unique();

    const isOwner = record.userId === (user._id as string);
    const isAdmin = membership?.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('Only the requester or an admin can cancel');
    }

    if (record.status !== 'pending') {
      throw new Error('Can only cancel pending requests');
    }

    await ctx.db.patch(args.recordId, { status: 'cancelled' });
  },
});
