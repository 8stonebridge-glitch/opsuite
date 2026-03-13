import type { MutationCtx, QueryCtx } from "./_generated/server";

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
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
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
