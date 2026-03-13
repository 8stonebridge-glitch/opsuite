import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ── Users (synced from Clerk via webhook or on first login) ──────
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email']),

  // ── Organizations ────────────────────────────────────────────────
  organizations: defineTable({
    name: v.string(),
    industry: v.object({
      id: v.string(),
      name: v.string(),
      sitesLabel: v.string(),
      color: v.string(),
    }),
    orgStructure: v.union(v.literal('with_subadmins'), v.literal('admin_only')),
    settings: v.object({
      noChangeAlertWorkdays: v.number(),
      reworkAlertCycles: v.number(),
    }),
    createdBy: v.id('users'),
    createdAt: v.string(),
  }),

  // ── Memberships (user ↔ org with role) ───────────────────────────
  memberships: defineTable({
    userId: v.id('users'),
    orgId: v.id('organizations'),
    role: v.union(v.literal('admin'), v.literal('subadmin'), v.literal('employee')),
    teamId: v.optional(v.string()),
    isActive: v.boolean(),
    joinedAt: v.string(),
  })
    .index('by_user', ['userId'])
    .index('by_org', ['orgId'])
    .index('by_user_org', ['userId', 'orgId']),

  // ── Sites ────────────────────────────────────────────────────────
  sites: defineTable({
    orgId: v.id('organizations'),
    name: v.string(),
  }).index('by_org', ['orgId']),

  // ── Teams ────────────────────────────────────────────────────────
  teams: defineTable({
    orgId: v.id('organizations'),
    name: v.string(),
    color: v.string(),
    leadUserId: v.id('users'),
  }).index('by_org', ['orgId']),

  // ── Team Members ─────────────────────────────────────────────────
  teamMembers: defineTable({
    teamId: v.id('teams'),
    userId: v.id('users'),
    orgId: v.id('organizations'),
  })
    .index('by_team', ['teamId'])
    .index('by_user', ['userId']),

  // ── Categories ───────────────────────────────────────────────────
  categories: defineTable({
    orgId: v.id('organizations'),
    name: v.string(),
  }).index('by_org', ['orgId']),

  // ── Tasks ────────────────────────────────────────────────────────
  tasks: defineTable({
    orgId: v.id('organizations'),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('Not Started'),
      v.literal('In Progress'),
      v.literal('Completed'),
      v.literal('Verified'),
      v.literal('Blocked')
    ),
    priority: v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('critical')
    ),
    categoryId: v.optional(v.string()),
    siteId: v.optional(v.string()),
    assigneeId: v.string(),
    accountableLeadId: v.optional(v.string()),
    delegatedAt: v.optional(v.string()),
    due: v.string(),
    createdAt: v.string(),
    completedAt: v.optional(v.string()),
    verifiedBy: v.optional(v.string()),
    reworked: v.optional(v.boolean()),
    reworkCount: v.optional(v.number()),
  })
    .index('by_org', ['orgId'])
    .index('by_assignee', ['assigneeId'])
    .index('by_org_status', ['orgId', 'status']),

  // ── Audit Trail ──────────────────────────────────────────────────
  audit: defineTable({
    orgId: v.id('organizations'),
    taskId: v.optional(v.string()),
    role: v.string(),
    message: v.string(),
    createdAt: v.string(),
    dateTag: v.string(),
    updateType: v.string(),
  })
    .index('by_org', ['orgId'])
    .index('by_task', ['taskId']),

  // ── Check-Ins ────────────────────────────────────────────────────
  checkIns: defineTable({
    orgId: v.id('organizations'),
    userId: v.string(),
    date: v.string(),
    time: v.string(),
    note: v.optional(v.string()),
  })
    .index('by_org', ['orgId'])
    .index('by_user_date', ['userId', 'date']),

  // ── Handoffs ─────────────────────────────────────────────────────
  handoffs: defineTable({
    orgId: v.id('organizations'),
    userId: v.string(),
    date: v.string(),
    tasks: v.array(
      v.object({
        taskId: v.string(),
        status: v.string(),
        note: v.optional(v.string()),
      })
    ),
    createdAt: v.string(),
  })
    .index('by_org', ['orgId'])
    .index('by_user_date', ['userId', 'date']),

  // ── Availability / Absence ───────────────────────────────────────
  availability: defineTable({
    orgId: v.id('organizations'),
    userId: v.string(),
    type: v.union(v.literal('leave'), v.literal('sick'), v.literal('off_duty')),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('approved'),
      v.literal('rejected'),
      v.literal('cancelled')
    ),
    approvedById: v.optional(v.string()),
    approvedAt: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index('by_org', ['orgId'])
    .index('by_user', ['userId'])
    .index('by_org_status', ['orgId', 'status']),
});
