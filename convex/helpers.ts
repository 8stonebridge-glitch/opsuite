import { QueryCtx, MutationCtx } from './_generated/server';

/**
 * Get the authenticated user from Clerk identity.
 * Throws if not authenticated — use in every query/mutation.
 */
export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  // Look up our user record by Clerk ID
  const user = await ctx.db
    .query('users')
    .withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
    .unique();

  if (!user) {
    throw new Error('User not found in database');
  }

  return { identity, user };
}

/**
 * Verify the user has a membership in the given org with the required role(s).
 */
export async function requireOrgRole(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  orgId: string,
  allowedRoles: Array<'admin' | 'subadmin' | 'employee'>
) {
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_user_org', (q) =>
      q.eq('userId', userId as any).eq('orgId', orgId as any)
    )
    .unique();

  if (!membership || !membership.isActive) {
    throw new Error('Not a member of this organization');
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new Error(`Insufficient permissions. Required: ${allowedRoles.join(', ')}`);
  }

  return membership;
}
