import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireActiveOrganizationMembership } from "./authHelpers";

function mapRole(
  role: "owner_admin" | "subadmin" | "employee",
): "admin" | "subadmin" | "employee" {
  return role === "owner_admin" ? "admin" : role;
}

function canViewTask(task: Doc<"tasks">, membership: Doc<"memberships">) {
  if (membership.role === "owner_admin") return true;
  if (membership.role === "subadmin") {
    return (
      task.accountableLeadMembershipId === membership._id ||
      task.assignedToMembershipId === membership._id
    );
  }
  return task.assignedToMembershipId === membership._id;
}

async function hydrateTasks(
  ctx: QueryCtx | MutationCtx,
  tasks: Doc<"tasks">[],
) {
  const siteIds = [...new Set(tasks.map((task) => task.siteId).filter(Boolean))] as Id<"sites">[];
  const teamIds = [...new Set(tasks.map((task) => task.teamId).filter(Boolean))] as Id<"teams">[];
  const membershipIds = [
    ...new Set(
      tasks.flatMap((task) =>
        [
          task.createdByMembershipId,
          task.accountableLeadMembershipId,
          task.assignedToMembershipId,
        ].filter(Boolean),
      ),
    ),
  ] as Id<"memberships">[];

  const [sites, teams, memberships] = await Promise.all([
    Promise.all(siteIds.map((siteId) => ctx.db.get(siteId))),
    Promise.all(teamIds.map((teamId) => ctx.db.get(teamId))),
    Promise.all(membershipIds.map((membershipId) => ctx.db.get(membershipId))),
  ]);

  const siteMap = new Map(
    sites.filter(Boolean).map((site) => [String(site!._id), site!]),
  );
  const teamMap = new Map(
    teams.filter(Boolean).map((team) => [String(team!._id), team!]),
  );
  const membershipMap = new Map(
    memberships.filter(Boolean).map((membership) => [String(membership!._id), membership!]),
  );

  const userIds = [
    ...new Set(
      memberships
        .filter(Boolean)
        .map((membership) => membership!.userId),
    ),
  ] as Id<"users">[];

  const users = await Promise.all(userIds.map((userId) => ctx.db.get(userId)));
  const userMap = new Map(
    users.filter(Boolean).map((user) => [String(user!._id), user!]),
  );

  return tasks.map((task) => {
    const site = task.siteId ? siteMap.get(String(task.siteId)) : null;
    const team = task.teamId ? teamMap.get(String(task.teamId)) : null;
    const creatorMembership = membershipMap.get(String(task.createdByMembershipId));
    const creatorUser = creatorMembership ? userMap.get(String(creatorMembership.userId)) : null;
    const accountableLeadMembership = membershipMap.get(String(task.accountableLeadMembershipId));
    const accountableLeadUser = accountableLeadMembership
      ? userMap.get(String(accountableLeadMembership.userId))
      : null;
    const assignedMembership = task.assignedToMembershipId
      ? membershipMap.get(String(task.assignedToMembershipId))
      : null;
    const assigneeUser = assignedMembership ? userMap.get(String(assignedMembership.userId)) : null;

    return {
      id: String(task._id),
      title: task.title,
      site: site?.name || "",
      siteId: task.siteId ? String(task.siteId) : "",
      category: task.description,
      priority: task.priority,
      due: task.dueDate || null,
      assignee: assigneeUser?.name || accountableLeadUser?.name || creatorUser?.name || "Unassigned",
      assigneeId: assigneeUser ? String(assigneeUser._id) : "",
      teamId: task.teamId ? String(task.teamId) : "",
      status: task.status === "Rejected" ? "Pending Approval" : task.status,
      assignedBy: creatorUser?.name || "Manager",
      assignedByRole: creatorMembership ? mapRole(creatorMembership.role) : "admin",
      note: task.note,
      approved: task.status !== "Pending Approval",
      createdAt: task.createdAt.split("T")[0] || task.createdAt,
      startedAt: task.startedAt?.split("T")[0],
      completedAt: task.completedAt?.split("T")[0],
      verifiedBy: undefined,
      reworked: task.isReworked,
      reworkCount: task.reworkCount,
      lastActivityAt: task.lastActivityAt,
      accountableLeadId:
        accountableLeadMembership?.role === "owner_admin"
          ? "admin"
          : accountableLeadUser
            ? String(accountableLeadUser._id)
            : undefined,
      accountableLeadName: accountableLeadUser?.name,
      delegatedAt: task.delegatedAt,
      lastNoChangeAt: task.lastNoChangeAt,
      stalledDays: 0,
    };
  });
}

export const listForCurrentScope = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .collect();

    const scopedTasks = tasks.filter((task) => canViewTask(task, membership));
    const hydratedScopedTasks = await hydrateTasks(ctx, scopedTasks);
    const hydratedAssignedTasks = await hydrateTasks(
      ctx,
      scopedTasks.filter((task) => task.createdByMembershipId === membership._id),
    );

    return {
      scopedTasks: hydratedScopedTasks,
      myAssignedTasks: hydratedAssignedTasks,
    };
  },
});

export const getDetail = query({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);
    const task = await ctx.db.get(args.taskId);

    if (!task || task.organizationId !== organizationId || !canViewTask(task, membership)) {
      return null;
    }

    const [hydratedTask] = await hydrateTasks(ctx, [task]);
    const audits = await ctx.db
      .query("taskAudits")
      .withIndex("by_task_created_at", (q) => q.eq("taskId", args.taskId))
      .collect();

    const actorMembershipIds = [
      ...new Set(audits.map((audit) => audit.actorMembershipId).filter(Boolean)),
    ] as Id<"memberships">[];

    const actorMemberships = await Promise.all(
      actorMembershipIds.map((membershipId) => ctx.db.get(membershipId)),
    );
    const actorMembershipMap = new Map(
      actorMemberships
        .filter(Boolean)
        .map((actorMembership) => [String(actorMembership!._id), actorMembership!]),
    );
    const actorUsers = await Promise.all(
      actorMemberships
        .filter(Boolean)
        .map((actorMembership) => ctx.db.get(actorMembership!.userId)),
    );
    const actorUserMap = new Map(
      actorUsers.filter(Boolean).map((actorUser) => [String(actorUser!._id), actorUser!]),
    );

    return {
      task: hydratedTask,
      audit: audits.map((audit) => {
        const actorMembership = audit.actorMembershipId
          ? actorMembershipMap.get(String(audit.actorMembershipId))
          : null;
        const actorUser = actorMembership ? actorUserMap.get(String(actorMembership.userId)) : null;
        return {
          id: String(audit._id),
          taskId: String(audit.taskId),
          role: actorMembership ? mapRole(actorMembership.role) : "System",
          message: audit.message,
          createdAt: audit.createdAt,
          dateTag: audit.createdAt.split("T")[0] || audit.createdAt,
          updateType: audit.type,
          actorName: actorUser?.name,
        };
      }),
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("critical")),
    siteId: v.optional(v.id("sites")),
    teamId: v.optional(v.id("teams")),
    assignedToMembershipId: v.optional(v.id("memberships")),
    accountableLeadMembershipId: v.id("memberships"),
    dueDate: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    if (membership.role === "employee") {
      throw new Error("Employees cannot assign tasks");
    }

    if (args.siteId) {
      const site = await ctx.db.get(args.siteId);
      if (!site || site.organizationId !== organizationId) {
        throw new Error("That site does not belong to the active organization");
      }
    }

    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      if (!team || team.organizationId !== organizationId) {
        throw new Error("That team does not belong to the active organization");
      }
    }

    const accountableLead = await ctx.db.get(args.accountableLeadMembershipId);
    if (
      !accountableLead ||
      accountableLead.organizationId !== organizationId ||
      accountableLead.status !== "active"
    ) {
      throw new Error("That accountable lead is not valid for the active organization");
    }

    if (membership.role === "subadmin" && accountableLead._id !== membership._id) {
      throw new Error("Subadmins can only create tasks under their own lead scope");
    }

    let assignedMembership = null;
    if (args.assignedToMembershipId) {
      assignedMembership = await ctx.db.get(args.assignedToMembershipId);
      if (
        !assignedMembership ||
        assignedMembership.organizationId !== organizationId ||
        assignedMembership.status !== "active"
      ) {
        throw new Error("That assignee is not valid for the active organization");
      }
    }

    const now = new Date().toISOString();
    const delegatedAt =
      membership.role === "subadmin" &&
      assignedMembership &&
      assignedMembership._id !== membership._id
        ? now
        : undefined;

    const taskId = await ctx.db.insert("tasks", {
      organizationId,
      siteId: args.siteId,
      teamId: args.teamId,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      priority: args.priority,
      status: "Open",
      createdByMembershipId: membership._id,
      accountableLeadMembershipId: args.accountableLeadMembershipId,
      assignedToMembershipId: args.assignedToMembershipId,
      delegatedAt,
      dueDate: args.dueDate || undefined,
      lastActivityAt: now,
      isReworked: false,
      reworkCount: 0,
      note: args.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    const actorUser = await ctx.db.get(membership.userId);
    const assigneeUser = assignedMembership ? await ctx.db.get(assignedMembership.userId) : null;

    const assignmentMessage = assigneeUser
      ? `Task assigned to ${assigneeUser.name} by ${actorUser?.name || "Manager"}${args.dueDate ? `. Due date: ${args.dueDate}.` : "."}`
      : `Task created by ${actorUser?.name || "Manager"}.`;

    await ctx.db.insert("taskAudits", {
      organizationId,
      taskId,
      actorMembershipId: membership._id,
      type: "Assignment",
      message: assignmentMessage,
      createdAt: now,
    });

    if (args.note?.trim()) {
      await ctx.db.insert("taskAudits", {
        organizationId,
        taskId,
        actorMembershipId: membership._id,
        type: "Instruction",
        message: args.note.trim(),
        createdAt: now,
      });
    }

    return await ctx.db.get(taskId);
  },
});
