import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveOrganizationMembership, requireOwnerMembership } from "./authHelpers";

export const listForActiveOrganization = query({
  args: {},
  handler: async (ctx) => {
    const { organizationId, membership } = await requireActiveOrganizationMembership(ctx);

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
      .collect();

    const visibleMemberships =
      membership.role === "owner_admin"
        ? memberships.filter((entry) => entry.status === "active")
        : memberships.filter((entry) => {
            if (entry.status !== "active") return false;
            if (entry._id === membership._id) return true;
            if (entry.role === "owner_admin") return false;

            const sharesTeam = entry.teamIds.some((teamId) => membership.teamIds.includes(teamId));
            const sharesSite = entry.siteIds.some((siteId) => membership.siteIds.includes(siteId));
            return sharesTeam || sharesSite;
          });

    const usersById = new Map(
      (
        await Promise.all(visibleMemberships.map((entry) => ctx.db.get(entry.userId)))
      )
        .filter(Boolean)
        .map((user) => [user!._id, user!]),
    );

    return visibleMemberships
      .map((entry) => {
        const user = usersById.get(entry.userId);
        if (!user) return null;
        return {
          membership: entry,
          user,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.user.name.localeCompare(b!.user.name));
  },
});

export const createProvisionedMember = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("subadmin"), v.literal("employee")),
    siteIds: v.array(v.id("sites")),
    teamIds: v.array(v.id("teams")),
  },
  handler: async (ctx, args) => {
    const { organizationId, user: ownerUser } = await requireOwnerMembership(ctx);

    const normalizedEmail = args.email.trim().toLowerCase();
    const trimmedName = args.name.trim();

    if (!normalizedEmail) {
      throw new Error("An email address is required");
    }

    if (!trimmedName) {
      throw new Error("A member name is required");
    }

    // In managed orgs employees must belong to a team; in direct orgs teams are optional
    if (args.role === "employee" && args.teamIds.length === 0) {
      const organization = await ctx.db.get(organizationId);
      if ((organization?.mode ?? "managed") !== "direct") {
        throw new Error("Employees must belong to at least one team");
      }
    }

    for (const siteId of args.siteIds) {
      const site = await ctx.db.get(siteId);
      if (!site || site.organizationId !== organizationId) {
        throw new Error("One of the selected sites does not belong to the active organization");
      }
    }

    for (const teamId of args.teamIds) {
      const team = await ctx.db.get(teamId);
      if (!team || team.organizationId !== organizationId) {
        throw new Error("One of the selected teams does not belong to the active organization");
      }
    }

    const now = new Date().toISOString();

    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, {
        name: trimmedName,
        updatedAt: now,
      });
      user = (await ctx.db.get(user._id))!;
    } else {
      const userId = await ctx.db.insert("users", {
        authUserId: `pending:${normalizedEmail}`,
        email: normalizedEmail,
        name: trimmedName,
        createdAt: now,
        updatedAt: now,
      });
      user = (await ctx.db.get(userId))!;
    }

    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", user._id),
      )
      .unique();

    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        role: args.role,
        siteIds: args.siteIds,
        teamIds: args.teamIds,
        status: "active",
        updatedAt: now,
      });

      return {
        user: await ctx.db.get(user._id),
        membership: await ctx.db.get(existingMembership._id),
      };
    }

    const membershipId = await ctx.db.insert("memberships", {
      userId: user._id,
      organizationId,
      role: args.role,
      siteIds: args.siteIds,
      teamIds: args.teamIds,
      status: "active",
      invitedByUserId: ownerUser._id,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      user: await ctx.db.get(user._id),
      membership: await ctx.db.get(membershipId),
    };
  },
});

/** Remove a member from the organization — owner only (soft-delete via status) */
export const removeMember = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { organizationId, user: ownerUser } = await requireOwnerMembership(ctx);

    if (args.userId === ownerUser._id) {
      throw new Error("You cannot remove yourself");
    }

    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", args.userId),
      )
      .unique();

    if (!membership) {
      throw new Error("User is not a member of this organization");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(membership._id, {
      status: "suspended",
      teamIds: [],
      siteIds: [],
      updatedAt: now,
    });

    return { removed: true };
  },
});

/** Update an existing member's profile (name, email) — owner only */
export const updateMember = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await requireOwnerMembership(ctx);

    // Ensure the target user is in this org
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", args.userId),
      )
      .unique();

    if (!membership || membership.status !== "active") {
      throw new Error("User is not a member of this organization");
    }

    const now = new Date().toISOString();
    const updates: Record<string, string> = { updatedAt: now };
    if (args.name) updates.name = args.name.trim();
    if (args.email) updates.email = args.email.trim().toLowerCase();

    await ctx.db.patch(args.userId, updates);
    return await ctx.db.get(args.userId);
  },
});
