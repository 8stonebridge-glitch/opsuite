import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const role = v.union(
  v.literal('owner_admin'),
  v.literal('subadmin'),
  v.literal('employee'),
);

const membershipStatus = v.union(
  v.literal('active'),
  v.literal('invited'),
  v.literal('suspended'),
);

const taskStatus = v.union(
  v.literal('Open'),
  v.literal('In Progress'),
  v.literal('Completed'),
  v.literal('Pending Approval'),
  v.literal('Verified'),
);

const priority = v.union(
  v.literal('low'),
  v.literal('medium'),
  v.literal('critical'),
);

const availabilityType = v.union(
  v.literal('leave'),
  v.literal('sick'),
  v.literal('off_duty'),
);

const availabilityStatus = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('cancelled'),
);

const inviteStatus = v.union(
  v.literal('pending'),
  v.literal('accepted'),
  v.literal('expired'),
  v.literal('revoked'),
);

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    activeOrganizationId: v.optional(v.id('organizations')),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_auth_user_id', ['authUserId'])
    .index('by_email', ['email']),

  signupDrafts: defineTable({
    email: v.string(),
    organizationName: v.string(),
    industryId: v.optional(v.string()),
    mode: v.union(v.literal('managed'), v.literal('direct')),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_email', ['email']),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    industryId: v.optional(v.string()),
    mode: v.union(v.literal('managed'), v.literal('direct')),
    ownerUserId: v.id('users'),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_owner_user_id', ['ownerUserId'])
    .index('by_slug', ['slug']),

  memberships: defineTable({
    userId: v.id('users'),
    organizationId: v.id('organizations'),
    role,
    siteIds: v.array(v.id('sites')),
    teamIds: v.array(v.id('teams')),
    status: membershipStatus,
    invitedByUserId: v.optional(v.id('users')),
    joinedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_user_id', ['userId'])
    .index('by_organization_id', ['organizationId'])
    .index('by_organization_role', ['organizationId', 'role'])
    .index('by_organization_user', ['organizationId', 'userId']),

  sites: defineTable({
    organizationId: v.id('organizations'),
    name: v.string(),
    code: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_organization_id', ['organizationId']),

  teams: defineTable({
    organizationId: v.id('organizations'),
    siteId: v.optional(v.id('sites')),
    name: v.string(),
    color: v.optional(v.string()),
    subadminMembershipId: v.optional(v.id('memberships')),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_organization_id', ['organizationId'])
    .index('by_organization_site', ['organizationId', 'siteId'])
    .index('by_subadmin_membership_id', ['subadminMembershipId']),

  tasks: defineTable({
    organizationId: v.id('organizations'),
    siteId: v.optional(v.id('sites')),
    teamId: v.optional(v.id('teams')),
    title: v.string(),
    description: v.optional(v.string()),
    priority,
    status: taskStatus,
    createdByMembershipId: v.id('memberships'),
    accountableLeadMembershipId: v.id('memberships'),
    assignedToMembershipId: v.optional(v.id('memberships')),
    delegatedAt: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    verifiedAt: v.optional(v.string()),
    lastActivityAt: v.string(),
    lastNoChangeAt: v.optional(v.string()),
    isReworked: v.boolean(),
    reworkCount: v.number(),
    note: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_organization_id', ['organizationId'])
    .index('by_organization_status', ['organizationId', 'status'])
    .index('by_organization_assignee', ['organizationId', 'assignedToMembershipId'])
    .index('by_organization_accountable_lead', ['organizationId', 'accountableLeadMembershipId'])
    .index('by_organization_site', ['organizationId', 'siteId'])
    .index('by_organization_team', ['organizationId', 'teamId'])
    .index('by_due_date', ['organizationId', 'dueDate']),

  taskAudits: defineTable({
    organizationId: v.id('organizations'),
    taskId: v.id('tasks'),
    actorMembershipId: v.optional(v.id('memberships')),
    type: v.string(),
    message: v.string(),
    createdAt: v.string(),
  })
    .index('by_organization_id', ['organizationId'])
    .index('by_task_id', ['taskId'])
    .index('by_task_created_at', ['taskId', 'createdAt']),

  dailyHandoffs: defineTable({
    organizationId: v.id('organizations'),
    membershipId: v.id('memberships'),
    date: v.string(),
    completedAt: v.string(),
    type: v.union(v.literal('tasks_reviewed'), v.literal('no_tasks')),
    tasksSummary: v.array(
      v.object({
        taskId: v.id('tasks'),
        action: v.union(v.literal('update'), v.literal('noChange')),
      }),
    ),
    summary: v.optional(v.string()),
  })
    .index('by_organization_id', ['organizationId'])
    .index('by_membership_date', ['membershipId', 'date'])
    .index('by_organization_membership_date', ['organizationId', 'membershipId', 'date']),

  availabilityRecords: defineTable({
    organizationId: v.id('organizations'),
    membershipId: v.id('memberships'),
    type: availabilityType,
    status: availabilityStatus,
    startDate: v.string(),
    endDate: v.string(),
    notes: v.optional(v.string()),
    requestedByMembershipId: v.id('memberships'),
    approvedByMembershipId: v.optional(v.id('memberships')),
    createdAt: v.string(),
    approvedAt: v.optional(v.string()),
  })
    .index('by_organization_id', ['organizationId'])
    .index('by_membership_id', ['membershipId'])
    .index('by_membership_start_date', ['membershipId', 'startDate'])
    .index('by_organization_status', ['organizationId', 'status']),

  invites: defineTable({
    organizationId: v.id('organizations'),
    email: v.string(),
    role,
    siteIds: v.array(v.id('sites')),
    teamIds: v.array(v.id('teams')),
    invitedByMembershipId: v.id('memberships'),
    status: inviteStatus,
    token: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
  })
    .index('by_organization_id', ['organizationId'])
    .index('by_organization_email', ['organizationId', 'email'])
    .index('by_token', ['token']),

  orgSettings: defineTable({
    organizationId: v.id('organizations'),
    noChangeAlertWorkdays: v.number(),
    reworkAlertCycles: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index('by_organization_id', ['organizationId']),
});
