import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { getAuthUser, requireOrgRole } from './helpers';
import { getNowISO, getTodayISO } from './shared';

// ── List tasks for an org (role-scoped) ────────────────────────────

export const listByOrg = query({
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

    const allTasks = await ctx.db
      .query('tasks')
      .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
      .collect();

    // Admin sees everything
    if (membership.role === 'admin') return allTasks;

    // Subadmin sees their team's tasks + their own
    if (membership.role === 'subadmin') {
      const myTeam = await ctx.db
        .query('teams')
        .withIndex('by_org', (q) => q.eq('orgId', args.orgId))
        .filter((q) => q.eq(q.field('leadUserId'), user._id))
        .first();

      if (!myTeam) return allTasks.filter((t) => t.assigneeId === (user._id as string));

      const teamMembers = await ctx.db
        .query('teamMembers')
        .withIndex('by_team', (q) => q.eq('teamId', myTeam._id))
        .collect();

      const teamUserIds = new Set([
        user._id as string,
        ...teamMembers.map((m) => m.userId as string),
      ]);

      return allTasks.filter(
        (t) => teamUserIds.has(t.assigneeId) || t.accountableLeadId === (user._id as string)
      );
    }

    // Employee sees only their own
    return allTasks.filter((t) => t.assigneeId === (user._id as string));
  },
});

// ── Get single task ────────────────────────────────────────────────

export const get = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');

    // Verify org membership
    await requireOrgRole(ctx, user._id as any, task.orgId as any, ['admin', 'subadmin', 'employee']);
    return task;
  },
});

// ── Create task (admin or subadmin) ────────────────────────────────

export const create = mutation({
  args: {
    orgId: v.id('organizations'),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('critical')),
    categoryId: v.optional(v.string()),
    siteId: v.optional(v.string()),
    assigneeId: v.string(),
    accountableLeadId: v.optional(v.string()),
    due: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    await requireOrgRole(ctx, user._id as any, args.orgId as any, ['admin', 'subadmin']);

    const now = getNowISO();
    const today = getTodayISO();

    const taskId = await ctx.db.insert('tasks', {
      orgId: args.orgId,
      title: args.title,
      description: args.description,
      status: 'Not Started',
      priority: args.priority,
      categoryId: args.categoryId,
      siteId: args.siteId,
      assigneeId: args.assigneeId,
      accountableLeadId: args.accountableLeadId,
      due: args.due,
      createdAt: now,
    });

    // Create audit entry
    await ctx.db.insert('audit', {
      orgId: args.orgId,
      taskId: taskId as string,
      role: 'Admin',
      message: `Task created and assigned`,
      createdAt: now,
      dateTag: today,
      updateType: 'Assignment',
    });

    return taskId;
  },
});

// ── Update task ────────────────────────────────────────────────────

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      status: v.optional(v.union(
        v.literal('Not Started'),
        v.literal('In Progress'),
        v.literal('Completed'),
        v.literal('Verified'),
        v.literal('Blocked')
      )),
      priority: v.optional(v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('critical'))),
      assigneeId: v.optional(v.string()),
      accountableLeadId: v.optional(v.string()),
      delegatedAt: v.optional(v.string()),
      due: v.optional(v.string()),
      completedAt: v.optional(v.string()),
      verifiedBy: v.optional(v.string()),
      categoryId: v.optional(v.string()),
      siteId: v.optional(v.string()),
    }),
    auditMessage: v.optional(v.string()),
    auditRole: v.optional(v.string()),
    auditUpdateType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');

    await requireOrgRole(ctx, user._id as any, task.orgId as any, ['admin', 'subadmin', 'employee']);

    // Apply updates
    const patchData: Record<string, any> = {};
    for (const [key, value] of Object.entries(args.updates)) {
      if (value !== undefined) patchData[key] = value;
    }
    if (Object.keys(patchData).length > 0) {
      await ctx.db.patch(args.taskId, patchData);
    }

    // Optional audit entry
    if (args.auditMessage) {
      await ctx.db.insert('audit', {
        orgId: task.orgId,
        taskId: args.taskId as string,
        role: args.auditRole || 'System',
        message: args.auditMessage,
        createdAt: getNowISO(),
        dateTag: getTodayISO(),
        updateType: args.auditUpdateType || 'Update',
      });
    }
  },
});

// ── Rework task (admin or subadmin) ────────────────────────────────

export const rework = mutation({
  args: {
    taskId: v.id('tasks'),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getAuthUser(ctx);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error('Task not found');

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_org', (q) =>
        q.eq('userId', user._id).eq('orgId', task.orgId)
      )
      .unique();

    if (!membership || (membership.role !== 'admin' && membership.role !== 'subadmin')) {
      throw new Error('Only admins and subadmins can request rework');
    }

    const org = await ctx.db.get(task.orgId);
    const reworkThreshold = org?.settings?.reworkAlertCycles || 3;
    const cycle = (task.reworkCount || 0) + 1;
    const isEscalated = cycle >= reworkThreshold;
    const now = getNowISO();
    const today = getTodayISO();

    await ctx.db.patch(args.taskId, {
      status: 'In Progress',
      reworked: true,
      reworkCount: cycle,
      priority: isEscalated ? 'critical' : task.priority,
      completedAt: undefined,
      verifiedBy: undefined,
    });

    await ctx.db.insert('audit', {
      orgId: task.orgId,
      taskId: args.taskId as string,
      role: membership.role === 'admin' ? 'Admin' : 'SubAdmin',
      message: `Rework requested by ${user.name}: ${args.reason}. Cycle ${cycle}.`,
      createdAt: now,
      dateTag: today,
      updateType: 'Rework',
    });

    if (isEscalated) {
      await ctx.db.insert('audit', {
        orgId: task.orgId,
        taskId: args.taskId as string,
        role: 'System',
        message: `⚠ Escalated to CRITICAL after ${cycle} rework cycles.`,
        createdAt: now,
        dateTag: today,
        updateType: 'Escalation',
      });
    }
  },
});
