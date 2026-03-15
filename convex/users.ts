import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import { displayNameFromIdentity, emailFromIdentity, requireIdentity, requireCurrentUser } from "./authHelpers";
import { createOrganizationForOwner } from "./organizations";

/**
 * On sign-in, verify the user's activeOrganizationId still points to an org
 * where they have an active membership. If not, reset to their owned org.
 */
async function maybeResetActiveOrganization(
  ctx: MutationCtx,
  userId: Id<"users">,
  currentActiveOrgId?: Id<"organizations">,
) {
  if (!currentActiveOrgId) return;

  // Check if user has an active membership in the current active org
  const currentMembership = await ctx.db
    .query("memberships")
    .withIndex("by_organization_user", (q) =>
      q.eq("organizationId", currentActiveOrgId).eq("userId", userId),
    )
    .unique();

  if (currentMembership && currentMembership.status === "active") {
    return; // Valid membership, nothing to fix
  }

  // Current active org is invalid — find an org they own
  const allMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();

  const ownedMembership = allMemberships.find(
    (m) => m.role === "owner_admin" && m.status === "active",
  );

  const fallbackMembership = ownedMembership || allMemberships.find((m) => m.status === "active");

  await ctx.db.patch(userId, {
    activeOrganizationId: fallbackMembership?.organizationId,
    updatedAt: new Date().toISOString(),
  });
}

async function maybeClaimSignupDraft(
  ctx: MutationCtx,
  userId: Id<"users">,
  email: string,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();

  if (memberships.length > 0) {
    return;
  }

  const draft = await ctx.db
    .query("signupDrafts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (!draft) {
    return;
  }

  await createOrganizationForOwner(ctx, {
    ownerUserId: userId,
    name: draft.organizationName,
    industryId: draft.industryId,
    mode: draft.mode,
  });

  await ctx.db.delete(draft._id);
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", identity.subject))
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

// Action wrapper: fetches email/name from Clerk API if JWT doesn't include them,
// then calls the syncFromAuth mutation with the resolved values.
export const syncFromAuthAction = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const jwtEmail =
      (typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "") ||
      (typeof (identity as any).emailAddress === "string" ? (identity as any).emailAddress.trim().toLowerCase() : "");

    let email = jwtEmail;
    let name = "";
    let avatarUrl: string | undefined;

    if (jwtEmail) {
      name = displayNameFromIdentity(identity as unknown as Record<string, unknown>);
      avatarUrl = typeof identity.pictureUrl === "string" ? identity.pictureUrl : undefined;
    } else {
      // JWT template doesn't include email — fetch from Clerk Backend API
      const clerkSecret = process.env.CLERK_SECRET_KEY;
      if (!clerkSecret) {
        throw new Error("CLERK_SECRET_KEY not set and JWT is missing email claim");
      }
      const res = await fetch(`https://api.clerk.com/v1/users/${identity.subject}`, {
        headers: { Authorization: `Bearer ${clerkSecret}` },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch user from Clerk: ${res.status}`);
      }
      const clerkUser = await res.json() as {
        email_addresses?: { email_address: string }[];
        first_name?: string;
        last_name?: string;
        image_url?: string;
      };
      const primaryEmail = clerkUser.email_addresses?.[0]?.email_address;
      if (!primaryEmail) {
        throw new Error("Clerk user has no email address");
      }
      email = primaryEmail.trim().toLowerCase();
      name = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(" ") || email;
      avatarUrl = clerkUser.image_url;
    }

    return await ctx.runMutation(internal.users.syncFromAuthInternal, {
      clerkEmail: email,
      clerkName: name,
      clerkAvatarUrl: avatarUrl,
    });
  },
});

const syncFromAuthArgs = {
  clerkEmail: v.optional(v.string()),
  clerkName: v.optional(v.string()),
  clerkAvatarUrl: v.optional(v.string()),
};

async function syncFromAuthHandler(ctx: MutationCtx, args: { clerkEmail?: string; clerkName?: string; clerkAvatarUrl?: string }) {
  const identity = await requireIdentity(ctx);
  const authUserId = identity.subject;

  const email = args.clerkEmail ||
    (typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "") ||
    (typeof (identity as any).emailAddress === "string" ? (identity as any).emailAddress.trim().toLowerCase() : "");

  if (!email) {
    throw new Error("No email available. Call syncFromAuthAction instead.");
  }

  const name = args.clerkName || displayNameFromIdentity(identity as unknown as Record<string, unknown>);
  const avatarUrl = args.clerkAvatarUrl || (typeof identity.pictureUrl === "string" ? identity.pictureUrl : undefined);
  const now = new Date().toISOString();

  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", authUserId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      email,
      name,
      avatarUrl,
      updatedAt: now,
    });
    await maybeClaimSignupDraft(ctx, existing._id, email);
    await maybeResetActiveOrganization(ctx, existing._id, existing.activeOrganizationId);
    return await ctx.db.get(existing._id);
  }

  const existingByEmail = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (existingByEmail) {
    await ctx.db.patch(existingByEmail._id, {
      authUserId,
      email,
      name,
      avatarUrl,
      updatedAt: now,
    });
    await maybeClaimSignupDraft(ctx, existingByEmail._id, email);
    await maybeResetActiveOrganization(ctx, existingByEmail._id, existingByEmail.activeOrganizationId);

    const refreshed = await ctx.db.get(existingByEmail._id);
    if (refreshed && !refreshed.activeOrganizationId) {
      const firstMembership = await ctx.db
        .query("memberships")
        .withIndex("by_user_id", (q) => q.eq("userId", existingByEmail._id))
        .first();
      if (firstMembership && firstMembership.status === "active") {
        await ctx.db.patch(existingByEmail._id, {
          activeOrganizationId: firstMembership.organizationId,
          updatedAt: now,
        });
      }
    }

    return await ctx.db.get(existingByEmail._id);
  }

  const userId = await ctx.db.insert("users", {
    authUserId,
    email,
    name,
    avatarUrl,
    createdAt: now,
    updatedAt: now,
  });

  await maybeClaimSignupDraft(ctx, userId, email);
  return await ctx.db.get(userId);
}

// Internal mutation called by syncFromAuthAction (avoids circular type ref)
export const syncFromAuthInternal = internalMutation({
  args: syncFromAuthArgs,
  handler: syncFromAuthHandler,
});

// Public mutation (can be called directly if JWT has email claim)
export const syncFromAuth = mutation({
  args: syncFromAuthArgs,
  handler: syncFromAuthHandler,
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
