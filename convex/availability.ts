import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireActiveOrganizationMembership } from "./authHelpers";

function canManageMember(
  managerMembership: Doc<"memberships">,
  targetMembership: Doc<"memberships">,
) {
  if (managerMembership.role === "owner_admin") {
    return true;
  }

  if (managerMembership.role === "subadmin") {
    if (targetMembership.role !== "employee") return false;
    return targetMembership.teamIds.some((teamId) =>
      managerMembership.teamIds.some((myTeamId) => String(myTeamId) === String(teamId)),
    );
  }

  return targetMembership._id === managerMembership._id;
}

function mapAvailabilityRecord(
  record: Doc<"availabilityRecords">,
  membershipMap: Map<string, Doc<"memberships">>,
) {
  const targetMembership = membershipMap.get(String(record.membershipId));
  const requesterMembership = membershipMap.get(String(record.requestedByMembershipId));
  const approverMembership = record.approvedByMembershipId
    ? membershipMap.get(String(record.approvedByMembershipId))
    : null;

  return {
    id: String(record._id),
    organizationId: String(record.organizationId),
    memberId: targetMembership ? String(targetMembership.userId) : "",
    type: record.type,
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate,
    notes: record.notes || "",
    requestedById: requesterMembership ? String(requesterMembership.userId) : "",
    approvedById: approverMembership ? String(approverMembership.userId) : null,
    createdAt: record.createdAt,
    approvedAt: record.approvedAt || null,
  };
}

async function getScopedMemberships(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  viewerMembership: Doc<"memberships">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
    .collect();

  return memberships.filter(
    (membership) => membership.status === "active" && canManageMember(viewerMembership, membership),
  );
}

export const listForCurrentScope = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);
    const scopedMemberships = await getScopedMemberships(ctx, organizationId, membership);
    const membershipMap = new Map(scopedMemberships.map((entry) => [String(entry._id), entry]));

    const availabilityRecords = await ctx.db
      .query("availabilityRecords")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .collect();

    return availabilityRecords
      .filter((record) => membershipMap.has(String(record.membershipId)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((record) => mapAvailabilityRecord(record, membershipMap));
  },
});

export const createRequest = mutation({
  args: {
    type: v.union(v.literal("leave"), v.literal("sick")),
    startDate: v.string(),
    endDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    if (args.endDate < args.startDate) {
      throw new Error("End date must be on or after the start date");
    }

    const now = new Date().toISOString();

    const recordId = await ctx.db.insert("availabilityRecords", {
      organizationId,
      membershipId: membership._id,
      type: args.type,
      status: "pending",
      startDate: args.startDate,
      endDate: args.endDate,
      notes: args.notes?.trim() || undefined,
      requestedByMembershipId: membership._id,
      approvedByMembershipId: undefined,
      createdAt: now,
      approvedAt: undefined,
    });

    const membershipMap = new Map([[String(membership._id), membership]]);
    const record = await ctx.db.get(recordId);
    if (!record) {
      throw new Error("Failed to create availability request");
    }

    return mapAvailabilityRecord(record, membershipMap);
  },
});

export const approve = mutation({
  args: {
    recordId: v.id("availabilityRecords"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    if (membership.role === "employee") {
      throw new Error("Employees cannot approve availability requests");
    }

    const record = await ctx.db.get(args.recordId);
    if (!record || record.organizationId !== organizationId) {
      throw new Error("Availability request not found in the active organization");
    }

    const targetMembership = await ctx.db.get(record.membershipId);
    if (!targetMembership || !canManageMember(membership, targetMembership)) {
      throw new Error("You do not have access to approve this request");
    }

    if (record.status !== "pending") {
      throw new Error("Only pending requests can be approved");
    }

    const approvedAt = new Date().toISOString();
    await ctx.db.patch(record._id, {
      status: "approved",
      approvedByMembershipId: membership._id,
      approvedAt,
    });

    return await ctx.db.get(record._id);
  },
});

export const reject = mutation({
  args: {
    recordId: v.id("availabilityRecords"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    if (membership.role === "employee") {
      throw new Error("Employees cannot reject availability requests");
    }

    const record = await ctx.db.get(args.recordId);
    if (!record || record.organizationId !== organizationId) {
      throw new Error("Availability request not found in the active organization");
    }

    const targetMembership = await ctx.db.get(record.membershipId);
    if (!targetMembership || !canManageMember(membership, targetMembership)) {
      throw new Error("You do not have access to reject this request");
    }

    if (record.status !== "pending") {
      throw new Error("Only pending requests can be rejected");
    }

    const approvedAt = new Date().toISOString();
    await ctx.db.patch(record._id, {
      status: "rejected",
      approvedByMembershipId: membership._id,
      approvedAt,
    });

    return await ctx.db.get(record._id);
  },
});

export const cancel = mutation({
  args: {
    recordId: v.id("availabilityRecords"),
  },
  handler: async (ctx, args) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);
    const record = await ctx.db.get(args.recordId);

    if (!record || record.organizationId !== organizationId) {
      throw new Error("Availability request not found in the active organization");
    }

    if (record.membershipId !== membership._id) {
      throw new Error("You can only cancel your own availability request");
    }

    if (record.status === "cancelled") {
      return record;
    }

    await ctx.db.patch(record._id, {
      status: "cancelled",
    });

    return await ctx.db.get(record._id);
  },
});
