import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireActiveOrganizationMembership } from "./authHelpers";

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
