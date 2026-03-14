import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireCurrentUser } from "./authHelpers";

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    noChangeAlertWorkdays: v.optional(v.number()),
    reworkAlertCycles: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .unique();

    if (!membership || membership.status !== "active" || membership.role !== "owner_admin") {
      throw new Error("Only the organization owner can update operational rules");
    }

    const settings = await ctx.db
      .query("orgSettings")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", args.organizationId))
      .unique();

    if (!settings) {
      throw new Error("Organization settings were not found");
    }

    const nextNoChangeAlertWorkdays = args.noChangeAlertWorkdays ?? settings.noChangeAlertWorkdays;
    const nextReworkAlertCycles = args.reworkAlertCycles ?? settings.reworkAlertCycles;

    const now = new Date().toISOString();

    await ctx.db.patch(settings._id, {
      noChangeAlertWorkdays: nextNoChangeAlertWorkdays,
      reworkAlertCycles: nextReworkAlertCycles,
      updatedAt: now,
    });

    return await ctx.db.get(settings._id);
  },
});
