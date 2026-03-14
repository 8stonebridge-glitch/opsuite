import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return identity;
}

export async function getCurrentUser(ctx: AuthCtx) {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_user_id", (q) => q.eq("authUserId", identity.subject))
    .unique();

  return { identity, user };
}

export async function requireCurrentUser(ctx: AuthCtx) {
  const { identity, user } = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("User record not initialized");
  }
  return { identity, user };
}

export async function requireActiveOrganizationMembership(ctx: AuthCtx) {
  const { identity, user } = await requireCurrentUser(ctx);

  if (!user.activeOrganizationId) {
    throw new Error("No active organization selected");
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organization_user", (q) =>
      q.eq("organizationId", user.activeOrganizationId as Id<"organizations">).eq("userId", user._id),
    )
    .unique();

  if (!membership || membership.status !== "active") {
    throw new Error("You do not have access to the active organization");
  }

  const organization = await ctx.db.get(user.activeOrganizationId);
  if (!organization) {
    throw new Error("Active organization not found");
  }

  return {
    identity,
    user,
    organization,
    membership,
    organizationId: organization._id as Id<"organizations">,
  };
}

export async function requireOwnerMembership(ctx: AuthCtx) {
  const access = await requireActiveOrganizationMembership(ctx);
  if (access.membership.role !== "owner_admin") {
    throw new Error("Only the organization owner can perform this action");
  }
  return access;
}

export function displayNameFromIdentity(identity: Record<string, unknown>) {
  const name = typeof identity.name === "string" ? identity.name.trim() : "";
  if (name) return name;

  const givenName = typeof identity.givenName === "string" ? identity.givenName.trim() : "";
  const familyName = typeof identity.familyName === "string" ? identity.familyName.trim() : "";
  const joined = [givenName, familyName].filter(Boolean).join(" ").trim();
  if (joined) return joined;

  const email = typeof identity.email === "string" ? identity.email.trim() : "";
  if (email) return email;

  return "User";
}

export function emailFromIdentity(identity: Record<string, unknown>) {
  const email = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
  if (!email) {
    throw new Error("Authenticated identity is missing an email address");
  }
  return email;
}

export function slugifyOrganizationName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "organization";
}
