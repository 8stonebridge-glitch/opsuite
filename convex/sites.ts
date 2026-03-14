import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveOrganizationMembership, requireOwnerMembership } from "./authHelpers";

export const listForActiveOrganization = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId } = await requireActiveOrganizationMembership(ctx);

    const sites = await ctx.db
      .query("sites")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .collect();

    return sites.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireOwnerMembership(ctx);
    const now = new Date().toISOString();

    const siteId = await ctx.db.insert("sites", {
      organizationId,
      name: args.name.trim(),
      code: args.code?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(siteId);
  },
});
