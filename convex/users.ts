import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { displayNameFromIdentity, emailFromIdentity, requireIdentity, requireCurrentUser } from "./authHelpers";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    return {
      identity: {
        subject: identity.subject,
        issuer: identity.issuer,
        email: typeof identity.email === "string" ? identity.email : null,
        name: typeof identity.name === "string" ? identity.name : null,
      },
      user,
    };
  },
});

export const syncFromClerk = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const clerkUserId = identity.subject;
    const email = emailFromIdentity(identity);
    const name = displayNameFromIdentity(identity);
    const avatarUrl = typeof identity.pictureUrl === "string" ? identity.pictureUrl : undefined;
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        name,
        avatarUrl,
        updatedAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existingByEmail) {
      await ctx.db.patch(existingByEmail._id, {
        clerkUserId,
        email,
        name,
        avatarUrl,
        updatedAt: now,
      });
      return await ctx.db.get(existingByEmail._id);
    }

    const userId = await ctx.db.insert("users", {
      clerkUserId,
      email,
      name,
      avatarUrl,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(userId);
  },
});

export const setActiveOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireCurrentUser(ctx);

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .unique();

    if (!membership || membership.status !== "active") {
      throw new Error("You do not have access to that organization");
    }

    await ctx.db.patch(user._id, {
      activeOrganizationId: args.organizationId,
      updatedAt: new Date().toISOString(),
    });

    return await ctx.db.get(user._id);
  },
});
