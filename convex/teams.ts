import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveOrganizationMembership, requireOwnerMembership } from "./authHelpers";

export const listForActiveOrganization = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireActiveOrganizationMembership(ctx);

    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .collect();

    return teams.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    subadminMembershipId: v.optional(v.id("memberships")),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireOwnerMembership(ctx);

    if (args.siteId) {
      const site = await ctx.db.get(args.siteId);
      if (!site || site.organizationId !== organizationId) {
        throw new Error("That site does not belong to the active organization");
      }
    }

    if (args.subadminMembershipId) {
      const membership = await ctx.db.get(args.subadminMembershipId);
      if (
        !membership ||
        membership.organizationId !== organizationId ||
        membership.role !== "subadmin" ||
        membership.status !== "active"
      ) {
        throw new Error("That subadmin does not belong to the active organization");
      }
    }

    const now = new Date().toISOString();

    const teamId = await ctx.db.insert("teams", {
      organizationId,
      siteId: args.siteId,
      name: args.name.trim(),
      color: args.color?.trim() || undefined,
      subadminMembershipId: args.subadminMembershipId,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(teamId);
  },
});
