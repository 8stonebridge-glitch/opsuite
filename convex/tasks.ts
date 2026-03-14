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

function getAllowedNextStatuses(
  current: Doc<"tasks">["status"],
  role: Doc<"memberships">["role"],
): Doc<"tasks">["status"][] {
  if (role === "employee") {
    if (current === "Open") return ["In Progress"];
    if (current === "In Progress") return ["Completed"];
    return [];
  }

  if (role === "subadmin" || role === "owner_admin") {
    if (current === "Open") return ["In Progress"];
    if (current === "In Progress") return ["Completed"];
    if (current === "Completed") return ["Verified"];
    if (current === "Pending Approval") return ["Open"];
    if (current === "Verified") return ["Open"];
  }

  return [];
}

async function getVisibleTask(
  ctx: QueryCtx | MutationCtx,
  taskId: Id<"tasks">,
) {
  const access = await requireActiveOrganizationMembership(ctx);
  const task = await ctx.db.get(taskId);

  if (!task || task.organizationId !== access.organizationId || !canViewTask(task, access.membership)) {
    throw new Error("Task not found in the active organization");
  }

  return { ...access, task };
}

async function insertTaskAudit(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    taskId: Id<"tasks">;
    actorMembershipId?: Id<"memberships">;
    type: string;
    message: string;
    createdAt: string;
  },
) {
  await ctx.db.insert("taskAudits", {
    organizationId: args.organizationId,
    taskId: args.taskId,
    actorMembershipId: args.actorMembershipId,
    type: args.type,
    message: args.message,
    createdAt: args.createdAt,
  });
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

async function hydrateAudits(
  ctx: QueryCtx | MutationCtx,
  audits: Doc<"taskAudits">[],
) {
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

  return audits.map((audit) => {
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
    const taskIds = scopedTasks.map((task) => task._id);
    const allAudits = await Promise.all(
      taskIds.map((taskId) =>
        ctx.db
          .query("taskAudits")
          .withIndex("by_task_created_at", (q) => q.eq("taskId", taskId))
          .collect(),
      ),
    );
    const hydratedAuditEntries = await hydrateAudits(
      ctx,
      allAudits.flat().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );

    return {
      scopedTasks: hydratedScopedTasks,
      myAssignedTasks: hydratedAssignedTasks,
      auditEntries: hydratedAuditEntries,
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

    let teamMembers: Array<{ membershipId: string; userId: string; name: string }> = [];
    if (
      membership.role === "subadmin" &&
      task.accountableLeadMembershipId === membership._id &&
      task.assignedToMembershipId === membership._id
    ) {
      const scopedMemberships = await ctx.db
        .query("memberships")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
        .collect();

      const eligibleMemberships = scopedMemberships.filter(
        (entry) =>
          entry.status === "active" &&
          entry.role === "employee" &&
          entry.teamIds.some((teamId) => membership.teamIds.map(String).includes(String(teamId))),
      );

      const eligibleUsers = await Promise.all(
        eligibleMemberships.map((entry) => ctx.db.get(entry.userId)),
      );

      teamMembers = eligibleMemberships
        .map((entry, index) => {
          const memberUser = eligibleUsers[index];
          if (!memberUser) return null;
          return {
            membershipId: String(entry._id),
            userId: String(memberUser._id),
            name: memberUser.name,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.name.localeCompare(b!.name)) as Array<{
          membershipId: string;
          userId: string;
          name: string;
        }>;
    }

    return {
      task: hydratedTask,
      canDelegate:
        membership.role === "subadmin" &&
        task.accountableLeadMembershipId === membership._id &&
        task.assignedToMembershipId === membership._id &&
        !task.delegatedAt,
      teamMembers,
      audit: await hydrateAudits(ctx, audits),
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

    if (args.dueDate) {
      const today = new Date().toISOString().split("T")[0];
      if (args.dueDate < today!) {
        throw new Error("Due date cannot be in the past");
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

export const addNote = mutation({
  args: {
    taskId: v.id("tasks"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task } = await getVisibleTask(ctx, args.taskId);
    const note = args.message.trim();

    if (!note) {
      throw new Error("A note is required");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(task._id, {
      lastActivityAt: now,
      updatedAt: now,
    });

    await insertTaskAudit(ctx, {
      organizationId,
      taskId: task._id,
      actorMembershipId: membership._id,
      type: "Note",
      message: note,
      createdAt: now,
    });

    return await ctx.db.get(task._id);
  },
});

export const updateStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(
      v.literal("Open"),
      v.literal("In Progress"),
      v.literal("Completed"),
      v.literal("Pending Approval"),
      v.literal("Verified"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task, user } = await getVisibleTask(ctx, args.taskId);
    const nextStatuses = getAllowedNextStatuses(task.status, membership.role);

    if (!nextStatuses.includes(args.status)) {
      throw new Error("That status transition is not allowed");
    }

    const now = new Date().toISOString();
    const today = now.split("T")[0] || now;
    const note = args.note?.trim();
    const isStart = args.status === "In Progress" && task.status === "Open";
    const isDone = args.status === "Completed";

    await ctx.db.patch(task._id, {
      status: args.status,
      startedAt: isStart ? today : task.startedAt,
      completedAt: isDone ? today : args.status === "Open" ? undefined : task.completedAt,
      lastActivityAt: now,
      updatedAt: now,
    });

    if (note) {
      await insertTaskAudit(ctx, {
        organizationId,
        taskId: task._id,
        actorMembershipId: membership._id,
        type: "Progress Update",
        message: note,
        createdAt: now,
      });
    }

    if (isStart) {
      await insertTaskAudit(ctx, {
        organizationId,
        taskId: task._id,
        actorMembershipId: membership._id,
        type: "Status",
        message: `▶ Task started on ${today} by ${user.name} (${mapRole(membership.role)}). Status: Open → In Progress.`,
        createdAt: now,
      });
    }

    if (isDone) {
      const isAssignee = task.assignedToMembershipId === membership._id;
      let completionMessage: string;
      if (isAssignee) {
        completionMessage = `✓ Task completed on ${today} by ${user.name} (${mapRole(membership.role)}). Awaiting verification.`;
      } else {
        const assigneeMembership = task.assignedToMembershipId
          ? await ctx.db.get(task.assignedToMembershipId)
          : null;
        const assigneeUser = assigneeMembership
          ? await ctx.db.get(assigneeMembership.userId)
          : null;
        const assigneeName = assigneeUser?.name || "assignee";
        completionMessage = `✓ Task marked complete on ${today} by ${user.name} (${mapRole(membership.role)}) on behalf of ${assigneeName}. Awaiting verification.`;
      }

      await insertTaskAudit(ctx, {
        organizationId,
        taskId: task._id,
        actorMembershipId: membership._id,
        type: "Status",
        message: completionMessage,
        createdAt: now,
      });

      const creatorMembership = await ctx.db.get(task.createdByMembershipId);
      const creatorUser = creatorMembership ? await ctx.db.get(creatorMembership.userId) : null;
      if (creatorUser) {
        await insertTaskAudit(ctx, {
          organizationId,
          taskId: task._id,
          type: "Notification",
          message: `📋 Notification sent to ${creatorUser.name}: "${task.title}" has been completed by ${user.name}.`,
          createdAt: now,
        });
      }
    }

    return await ctx.db.get(task._id);
  },
});

export const markNoChange = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task, user } = await getVisibleTask(ctx, args.taskId);

    if (task.assignedToMembershipId !== membership._id) {
      throw new Error("Only the current assignee can report no change");
    }

    if (task.status !== "Open" && task.status !== "In Progress") {
      throw new Error("No change can only be reported on active tasks");
    }

    const now = new Date().toISOString();
    const today = now.split("T")[0] || now;

    await ctx.db.patch(task._id, {
      lastNoChangeAt: today,
      lastActivityAt: now,
      updatedAt: now,
    });

    await insertTaskAudit(ctx, {
      organizationId,
      taskId: task._id,
      actorMembershipId: membership._id,
      type: "No Change",
      message: `No change reported by ${user.name}.`,
      createdAt: now,
    });

    return await ctx.db.get(task._id);
  },
});

export const delegate = mutation({
  args: {
    taskId: v.id("tasks"),
    assigneeMembershipId: v.id("memberships"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task, user } = await getVisibleTask(ctx, args.taskId);

    if (membership.role !== "subadmin") {
      throw new Error("Only subadmins can delegate tasks");
    }

    if (task.accountableLeadMembershipId !== membership._id) {
      throw new Error("Only the accountable subadmin can delegate this task");
    }

    if (task.assignedToMembershipId !== membership._id) {
      throw new Error("This task has already been delegated");
    }

    const assigneeMembership = await ctx.db.get(args.assigneeMembershipId);
    if (
      !assigneeMembership ||
      assigneeMembership.organizationId !== organizationId ||
      assigneeMembership.status !== "active" ||
      assigneeMembership.role !== "employee"
    ) {
      throw new Error("That employee is not valid for this organization");
    }

    const teamIds = membership.teamIds.map(String);
    const sharesTeam = assigneeMembership.teamIds.some((teamId) => teamIds.includes(String(teamId)));
    if (!sharesTeam) {
      throw new Error("You can only delegate to people in your scope");
    }

    const assigneeUser = await ctx.db.get(assigneeMembership.userId);
    const now = new Date().toISOString();

    await ctx.db.patch(task._id, {
      assignedToMembershipId: assigneeMembership._id,
      delegatedAt: now,
      lastActivityAt: now,
      updatedAt: now,
    });

    await insertTaskAudit(ctx, {
      organizationId,
      taskId: task._id,
      actorMembershipId: membership._id,
      type: "Delegated",
      message: `Delegated to ${assigneeUser?.name || "team member"} by ${user.name}.`,
      createdAt: now,
    });

    return await ctx.db.get(task._id);
  },
});

export const approvePending = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task, user } = await getVisibleTask(ctx, args.taskId);

    if (membership.role === "employee") {
      throw new Error("Employees cannot approve tasks");
    }

    if (task.status !== "Pending Approval") {
      throw new Error("Only pending-approval tasks can be approved");
    }

    const now = new Date().toISOString();

    await ctx.db.patch(task._id, {
      status: "Open",
      lastActivityAt: now,
      updatedAt: now,
    });

    await insertTaskAudit(ctx, {
      organizationId,
      taskId: task._id,
      actorMembershipId: membership._id,
      type: "Approval",
      message: `Approved by ${user.name}. Work may proceed.`,
      createdAt: now,
    });

    return await ctx.db.get(task._id);
  },
});

export const verify = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task, user } = await getVisibleTask(ctx, args.taskId);

    if (membership.role === "employee") {
      throw new Error("Employees cannot verify tasks");
    }

    if (task.status !== "Completed") {
      throw new Error("Only completed tasks can be verified");
    }

    const now = new Date().toISOString();
    const completedLate = task.dueDate && task.completedAt && task.completedAt > task.dueDate;

    await ctx.db.patch(task._id, {
      status: "Verified",
      verifiedAt: now.split("T")[0] || now,
      lastActivityAt: now,
      updatedAt: now,
    });

    await insertTaskAudit(ctx, {
      organizationId,
      taskId: task._id,
      type: "Verified",
      message: `✓ Verified & closed by ${user.name}.${completedLate ? " ⚠ Completed past due date." : ""}`,
      createdAt: now,
    });

    const creatorMembership = await ctx.db.get(task.createdByMembershipId);
    const creatorUser = creatorMembership ? await ctx.db.get(creatorMembership.userId) : null;
    if (creatorUser) {
      await insertTaskAudit(ctx, {
        organizationId,
        taskId: task._id,
        type: "Notification",
        message: `📋 ${creatorUser.name} notified: "${task.title}" has been verified and closed.`,
        createdAt: now,
      });
    }

    return await ctx.db.get(task._id);
  },
});

export const requestRework = mutation({
  args: {
    taskId: v.id("tasks"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership, task, user } = await getVisibleTask(ctx, args.taskId);

    if (membership.role === "employee") {
      throw new Error("Employees cannot request rework");
    }

    if (task.status !== "Completed") {
      throw new Error("Only completed tasks can be sent to rework");
    }

    const settings = await ctx.db
      .query("orgSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .unique();

    const reason = args.reason.trim();
    if (!reason) {
      throw new Error("A rework reason is required");
    }

    const cycle = task.reworkCount + 1;
    const escalated = cycle >= (settings?.reworkAlertCycles ?? 3);
    const now = new Date().toISOString();

    await ctx.db.patch(task._id, {
      status: "In Progress",
      isReworked: true,
      reworkCount: cycle,
      priority: escalated ? "critical" : task.priority,
      completedAt: undefined,
      verifiedAt: undefined,
      lastActivityAt: now,
      updatedAt: now,
    });

    await insertTaskAudit(ctx, {
      organizationId,
      taskId: task._id,
      actorMembershipId: membership._id,
      type: "Rework",
      message: `Rework requested by ${user.name}: ${reason}. Cycle ${cycle}.`,
      createdAt: now,
    });

    if (escalated) {
      await insertTaskAudit(ctx, {
        organizationId,
        taskId: task._id,
        type: "Escalation",
        message: `⚠ Escalated to CRITICAL after ${cycle} rework cycles.`,
        createdAt: now,
      });
    }

    return await ctx.db.get(task._id);
  },
});
