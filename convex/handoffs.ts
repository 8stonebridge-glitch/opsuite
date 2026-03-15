import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireActiveOrganizationMembership } from "./authHelpers";

const ENGAGEMENT_TYPES = new Set([
  "Status",
  "Progress Update",
  "Note",
  "No Change",
  "Rework",
  "Assignment",
  "Approval",
  "Verification",
]);

function formatCheckInTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function getActiveAssignedTasks(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  membershipId: Id<"memberships">,
) {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_organization_assignee", (q) =>
      q.eq("organizationId", organizationId).eq("assignedToMembershipId", membershipId),
    )
    .collect();

  return tasks.filter((task) => task.status === "Open" || task.status === "In Progress");
}

async function getEngagementByTaskId(
  ctx: QueryCtx | MutationCtx,
  taskIds: Id<"tasks">[],
  membershipId: Id<"memberships">,
  date: string,
) {
  const engagementByTaskId = new Map<string, { engaged: boolean; noChange: boolean }>();

  await Promise.all(
    taskIds.map(async (taskId) => {
      const audits = await ctx.db
        .query("taskAudits")
        .withIndex("by_task_created_at", (q) => q.eq("taskId", taskId))
        .collect();

      const todayAudits = audits.filter(
        (audit) =>
          audit.actorMembershipId === membershipId &&
          audit.createdAt.startsWith(date) &&
          ENGAGEMENT_TYPES.has(audit.type),
      );

      engagementByTaskId.set(String(taskId), {
        engaged: todayAudits.length > 0,
        noChange: todayAudits.some((audit) => audit.type === "No Change"),
      });
    }),
  );

  return engagementByTaskId;
}

async function mapTasksForHandoffList(
  ctx: QueryCtx | MutationCtx,
  tasks: Doc<"tasks">[],
) {
  const siteIds = [...new Set(tasks.map((task) => task.siteId).filter(Boolean))] as Id<"sites">[];
  const sites = await Promise.all(siteIds.map((siteId) => ctx.db.get(siteId)));
  const siteMap = new Map(sites.filter(Boolean).map((site) => [String(site!._id), site!]));

  return tasks.map((task) => ({
    id: String(task._id),
    title: task.title,
    site: task.siteId ? siteMap.get(String(task.siteId))?.name || "" : "",
    siteId: task.siteId ? String(task.siteId) : "",
  }));
}

function mapHandoffRecord(
  handoff: Doc<"dailyHandoffs">,
  userId: string,
) {
  return {
    userId,
    date: handoff.date,
    completedAt: handoff.completedAt,
    tasksSummary: handoff.tasksSummary.map((summary) => ({
      taskId: String(summary.taskId),
      action: summary.action,
    })),
    type: handoff.type,
  };
}

function mapCheckInRecord(
  handoff: Doc<"dailyHandoffs">,
  userId: string,
) {
  return {
    userId,
    date: handoff.date,
    status: "Checked-In" as const,
    type: handoff.type === "tasks_reviewed" ? "Tasks Reviewed" : "No Tasks",
    checkedInAt: formatCheckInTime(handoff.completedAt),
    summary:
      handoff.type === "tasks_reviewed"
        ? `${handoff.tasksSummary.length} tasks reviewed`
        : "No active tasks",
  };
}

export const myProgress = query({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);
    const activeTasks = await getActiveAssignedTasks(ctx, organizationId, membership._id);
    const engagementByTaskId = await getEngagementByTaskId(
      ctx,
      activeTasks.map((task) => task._id),
      membership._id,
      args.date,
    );
    const remainingTasks = activeTasks.filter(
      (task) => !engagementByTaskId.get(String(task._id))?.engaged,
    );
    const handoff = await ctx.db
      .query("dailyHandoffs")
      .withIndex("by_organization_membership_date", (q) =>
        q.eq("organizationId", organizationId).eq("membershipId", membership._id).eq("date", args.date),
      )
      .unique();

    return {
      total: activeTasks.length,
      engaged: activeTasks.length - remainingTasks.length,
      remainingTasks: await mapTasksForHandoffList(ctx, remainingTasks),
      engagedTaskIds: activeTasks
        .filter((task) => engagementByTaskId.get(String(task._id))?.engaged)
        .map((task) => String(task._id)),
      canComplete: activeTasks.length === 0 || remainingTasks.length === 0,
      handoffDone: Boolean(handoff),
      handoff:
        handoff && membership.userId
          ? mapHandoffRecord(handoff, String(membership.userId))
          : null,
    };
  },
});

export const completeForToday = mutation({
  args: {
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);
    const existing = await ctx.db
      .query("dailyHandoffs")
      .withIndex("by_organization_membership_date", (q) =>
        q.eq("organizationId", organizationId).eq("membershipId", membership._id).eq("date", args.date),
      )
      .unique();

    if (existing) {
      return mapHandoffRecord(existing, String(membership.userId));
    }

    const activeTasks = await getActiveAssignedTasks(ctx, organizationId, membership._id);
    const engagementByTaskId = await getEngagementByTaskId(
      ctx,
      activeTasks.map((task) => task._id),
      membership._id,
      args.date,
    );
    const remainingTasks = activeTasks.filter(
      (task) => !engagementByTaskId.get(String(task._id))?.engaged,
    );

    if (activeTasks.length > 0 && remainingTasks.length > 0) {
      throw new Error("Review every active task before completing handoff");
    }

    const now = new Date().toISOString();
    const handoffId = await ctx.db.insert("dailyHandoffs", {
      organizationId,
      membershipId: membership._id,
      date: args.date,
      completedAt: now,
      type: activeTasks.length > 0 ? "tasks_reviewed" : "no_tasks",
      tasksSummary: activeTasks.map((task) => ({
        taskId: task._id,
        action: engagementByTaskId.get(String(task._id))?.noChange ? "noChange" : "update",
      })),
      summary: activeTasks.length > 0 ? `${activeTasks.length} tasks reviewed` : "No active tasks",
    });

    const handoff = await ctx.db.get(handoffId);
    if (!handoff) {
      throw new Error("Failed to save daily handoff");
    }

    return mapHandoffRecord(handoff, String(membership.userId));
  },
});

export const listForCurrentScope = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    let scopedHandoffs: Doc<"dailyHandoffs">[] = [];
    let scopedMembershipIds: Set<string>;
    const membershipMap = new Map<string, Doc<"memberships">>();

    if (membership.role === "employee") {
      // Employees only see their own handoffs — direct index hit, no full scan
      scopedMembershipIds = new Set([String(membership._id)]);
      membershipMap.set(String(membership._id), membership);
      scopedHandoffs = await ctx.db
        .query("dailyHandoffs")
        .withIndex("by_organization_membership_date", (q) =>
          q.eq("organizationId", organizationId).eq("membershipId", membership._id)
        )
        .collect();
    } else {
      // Subadmins and Admins need to see team/org-wide handoffs
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
        .collect();

      const filtered = memberships.filter((entry) => {
        if (entry.status !== "active") return false;
        if (membership.role === "owner_admin") return true;
        if (entry._id === membership._id) return true;
        return entry.teamIds.some((teamId) =>
          membership.teamIds.some((myTeamId) => String(myTeamId) === String(teamId)),
        );
      });

      scopedMembershipIds = new Set(filtered.map((e) => String(e._id)));
      for (const m of filtered) membershipMap.set(String(m._id), m);

      // For subadmins with a small team, query per-member instead of full org
      if (membership.role === "subadmin" && filtered.length <= 20) {
        const perMember = await Promise.all(
          filtered.map((m) =>
            ctx.db
              .query("dailyHandoffs")
              .withIndex("by_organization_membership_date", (q) =>
                q.eq("organizationId", organizationId).eq("membershipId", m._id)
              )
              .collect()
          )
        );
        scopedHandoffs = perMember.flat();
      } else {
        // Admin or large teams — full org scan (legitimate need)
        const allHandoffs = await ctx.db
          .query("dailyHandoffs")
          .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
          .collect();
        scopedHandoffs = allHandoffs.filter((h) => scopedMembershipIds.has(String(h.membershipId)));
      }
    }

    scopedHandoffs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));

    const users = await Promise.all(
      [...new Set([...membershipMap.values()].map((e) => e.userId))].map((userId) => ctx.db.get(userId)),
    );
    const userMap = new Map(users.filter(Boolean).map((user) => [String(user!._id), user!]));

    return {
      handoffs: scopedHandoffs.map((handoff) => {
        const handoffMembership = membershipMap.get(String(handoff.membershipId));
        const handoffUser = handoffMembership ? userMap.get(String(handoffMembership.userId)) : null;
        return mapHandoffRecord(handoff, handoffUser ? String(handoffUser._id) : "");
      }),
      checkIns: scopedHandoffs.map((handoff) => {
        const handoffMembership = membershipMap.get(String(handoff.membershipId));
        const handoffUser = handoffMembership ? userMap.get(String(handoffMembership.userId)) : null;
        return mapCheckInRecord(handoff, handoffUser ? String(handoffUser._id) : "");
      }),
    };
  },
});
