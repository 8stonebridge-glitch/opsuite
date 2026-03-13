import { query } from "./_generated/server";
import { requireActiveOrganizationMembership } from "./authHelpers";

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
