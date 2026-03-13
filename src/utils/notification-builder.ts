import type {
  AppNotification,
  Task,
  AuditEntry,
  HandoffRecord,
  AvailabilityRecord,
  Team,
  Role,
} from '../types';
import { getToday, isOverdue, getNowISO } from './date';
import { getActiveAvailability, pendingAvailabilityRequestsForScope, coverageNeededTasksForScope } from './availability-helpers';
import { getHandoffProgress } from './handoff-helpers';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Deterministic notification ID based on type + key data.
 * Stable across re-renders so React keys don't churn.
 */
function nid(prefix: string, key: string): string {
  return `notif-${prefix}-${key}`;
}

function todayISO(): string {
  return getNowISO();
}

// ── Public API ───────────────────────────────────────────────────────

export function buildNotificationsForRole(
  role: Role,
  userId: string | null,
  tasks: Task[],
  audit: AuditEntry[],
  handoffs: HandoffRecord[],
  availability: AvailabilityRecord[],
  teams: Team[]
): AppNotification[] {
  const today = getToday();

  if (role === 'employee' && userId) {
    return buildEmployeeNotifications(userId, tasks, audit, handoffs, availability, today);
  }
  if (role === 'subadmin' && userId) {
    return buildSubadminNotifications(userId, tasks, audit, handoffs, availability, teams, today);
  }
  if (role === 'admin') {
    return buildAdminNotifications(tasks, audit, availability, teams, today);
  }

  return [];
}

// ── Employee Notifications ───────────────────────────────────────────

function buildEmployeeNotifications(
  userId: string,
  tasks: Task[],
  audit: AuditEntry[],
  handoffs: HandoffRecord[],
  availability: AvailabilityRecord[],
  today: string
): AppNotification[] {
  const notifs: AppNotification[] = [];
  const now = todayISO();
  const myTasks = tasks.filter((t) => t.assigneeId === userId);

  // Tasks assigned today
  const assignedToday = audit.filter(
    (a) =>
      a.dateTag === today &&
      a.updateType === 'Assignment' &&
      a.taskId !== null &&
      myTasks.some((t) => t.id === a.taskId)
  );
  for (const entry of assignedToday) {
    const task = myTasks.find((t) => t.id === entry.taskId);
    if (task) {
      notifs.push({
        id: nid('assign', entry.id),
        title: 'New Task Assigned',
        body: task.title,
        timestamp: entry.createdAt,
        type: 'task',
        taskId: task.id,
      });
    }
  }

  // Tasks delegated to me
  const delegated = audit.filter(
    (a) =>
      a.dateTag === today &&
      a.updateType === 'Delegated' &&
      a.taskId !== null &&
      myTasks.some((t) => t.id === a.taskId)
  );
  for (const entry of delegated) {
    const task = myTasks.find((t) => t.id === entry.taskId);
    if (task) {
      notifs.push({
        id: nid('deleg', entry.id),
        title: 'Task Delegated to You',
        body: task.title,
        timestamp: entry.createdAt,
        type: 'task',
        taskId: task.id,
      });
    }
  }

  // Rework on my tasks
  const reworkEntries = audit.filter(
    (a) =>
      a.dateTag === today &&
      a.updateType === 'Rework' &&
      a.taskId !== null &&
      myTasks.some((t) => t.id === a.taskId)
  );
  for (const entry of reworkEntries) {
    const task = myTasks.find((t) => t.id === entry.taskId);
    if (task) {
      notifs.push({
        id: nid('rework', entry.id),
        title: 'Rework Requested',
        body: task.title,
        timestamp: entry.createdAt,
        type: 'task',
        taskId: task.id,
      });
    }
  }

  // Verification on my tasks
  const verified = audit.filter(
    (a) =>
      a.dateTag === today &&
      a.updateType === 'Verification' &&
      a.taskId !== null &&
      myTasks.some((t) => t.id === a.taskId)
  );
  for (const entry of verified) {
    const task = myTasks.find((t) => t.id === entry.taskId);
    if (task) {
      notifs.push({
        id: nid('verify', entry.id),
        title: 'Task Verified',
        body: task.title,
        timestamp: entry.createdAt,
        type: 'task',
        taskId: task.id,
      });
    }
  }

  // Due today
  const dueToday = myTasks.filter(
    (t) =>
      t.due === today &&
      t.status !== 'Verified' &&
      t.status !== 'Completed'
  );
  for (const task of dueToday) {
    notifs.push({
      id: nid('due', task.id),
      title: 'Due Today',
      body: task.title,
      timestamp: now,
      type: 'task',
      taskId: task.id,
    });
  }

  // Overdue
  const overdue = myTasks.filter((t) => isOverdue(t.due, t.status));
  for (const task of overdue) {
    notifs.push({
      id: nid('overdue', task.id),
      title: 'Overdue',
      body: task.title,
      timestamp: now,
      type: 'task',
      taskId: task.id,
    });
  }

  // Availability state
  const activeAvail = getActiveAvailability(userId, today, availability);
  if (activeAvail) {
    const typeLabel = activeAvail.type === 'leave' ? 'Leave' : activeAvail.type === 'sick' ? 'Sick' : 'Off Duty';
    const statusLabel = activeAvail.status === 'pending' ? 'pending approval' : activeAvail.status;
    notifs.push({
      id: nid('avail', activeAvail.id),
      title: `${typeLabel} — ${statusLabel}`,
      body: `${activeAvail.startDate} to ${activeAvail.endDate}`,
      timestamp: activeAvail.createdAt,
      type: 'availability',
    });
  }

  // Handoff reminder
  const { remaining } = getHandoffProgress(tasks, userId, audit);
  const alreadyDone = handoffs.some((h) => h.userId === userId && h.date === today);
  if (remaining.length > 0 && !alreadyDone) {
    notifs.push({
      id: nid('handoff', userId),
      title: 'Daily Handoff Pending',
      body: `${remaining.length} task${remaining.length > 1 ? 's' : ''} still need review`,
      timestamp: now,
      type: 'handoff',
      route: 'handoff',
    });
  }

  // Sort reverse-chronological
  return notifs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ── SubAdmin Notifications ───────────────────────────────────────────

function buildSubadminNotifications(
  userId: string,
  tasks: Task[],
  audit: AuditEntry[],
  handoffs: HandoffRecord[],
  availability: AvailabilityRecord[],
  teams: Team[],
  today: string
): AppNotification[] {
  const notifs: AppNotification[] = [];
  const now = todayISO();

  // Pending availability requests for my team
  const pendingRequests = pendingAvailabilityRequestsForScope(userId, availability, teams, 'subadmin');
  if (pendingRequests.length > 0) {
    notifs.push({
      id: nid('sub-pending', userId),
      title: 'Pending Absence Requests',
      body: `${pendingRequests.length} request${pendingRequests.length > 1 ? 's' : ''} awaiting your approval`,
      timestamp: now,
      type: 'availability',
      route: 'availability',
    });
  }

  // Coverage-needed tasks for my team
  const coverageTasks = coverageNeededTasksForScope(userId, today, tasks, availability, teams, 'subadmin');
  if (coverageTasks.length > 0) {
    notifs.push({
      id: nid('sub-coverage', userId),
      title: 'Coverage Needed',
      body: `${coverageTasks.length} task${coverageTasks.length > 1 ? 's' : ''} need reassignment due to absence`,
      timestamp: now,
      type: 'coverage',
    });
  }

  // Team tasks completed and needing review
  const team = teams.find((t) => t.lead.id === userId);
  const teamMemberIds = team ? team.members.map((m) => m.id) : [];
  const reviewQueue = tasks.filter(
    (t) =>
      teamMemberIds.includes(t.assigneeId) &&
      t.status === 'Completed'
  );
  if (reviewQueue.length > 0) {
    notifs.push({
      id: nid('sub-review', userId),
      title: 'Tasks Ready for Review',
      body: `${reviewQueue.length} completed task${reviewQueue.length > 1 ? 's' : ''} need verification`,
      timestamp: now,
      type: 'review',
    });
  }

  // Tasks assigned to me as lead that still need delegation
  const needsDelegation = tasks.filter(
    (t) =>
      t.accountableLeadId === userId &&
      t.assigneeId === userId &&
      !t.delegatedAt &&
      t.status !== 'Verified'
  );
  if (needsDelegation.length > 0) {
    notifs.push({
      id: nid('sub-deleg', userId),
      title: 'Tasks Awaiting Delegation',
      body: `${needsDelegation.length} task${needsDelegation.length > 1 ? 's' : ''} assigned to you need delegation`,
      timestamp: now,
      type: 'task',
    });
  }

  // Handoff reminder (subadmins do handoffs too)
  const { remaining } = getHandoffProgress(tasks, userId, audit);
  const alreadyDone = handoffs.some((h) => h.userId === userId && h.date === today);
  if (remaining.length > 0 && !alreadyDone) {
    notifs.push({
      id: nid('sub-handoff', userId),
      title: 'Daily Handoff Pending',
      body: `${remaining.length} task${remaining.length > 1 ? 's' : ''} still need review`,
      timestamp: now,
      type: 'handoff',
      route: 'handoff',
    });
  }

  return notifs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ── Admin Notifications ──────────────────────────────────────────────

function buildAdminNotifications(
  tasks: Task[],
  audit: AuditEntry[],
  availability: AvailabilityRecord[],
  teams: Team[],
  today: string
): AppNotification[] {
  const notifs: AppNotification[] = [];
  const now = todayISO();

  // Pending availability requests (admin scope)
  const pendingRequests = pendingAvailabilityRequestsForScope(null, availability, teams, 'admin');
  if (pendingRequests.length > 0) {
    notifs.push({
      id: nid('admin-pending', today),
      title: 'Pending Absence Requests',
      body: `${pendingRequests.length} request${pendingRequests.length > 1 ? 's' : ''} awaiting approval`,
      timestamp: now,
      type: 'availability',
      route: 'availability',
    });
  }

  // Coverage-needed tasks (admin scope)
  const coverageTasks = coverageNeededTasksForScope(null, today, tasks, availability, teams, 'admin');
  if (coverageTasks.length > 0) {
    notifs.push({
      id: nid('admin-coverage', today),
      title: 'Coverage Needed',
      body: `${coverageTasks.length} task${coverageTasks.length > 1 ? 's' : ''} need reassignment due to absence`,
      timestamp: now,
      type: 'coverage',
    });
  }

  // Review queue — all completed tasks needing verification
  const reviewQueue = tasks.filter((t) => t.status === 'Completed');
  if (reviewQueue.length > 0) {
    notifs.push({
      id: nid('admin-review', today),
      title: 'Tasks Ready for Review',
      body: `${reviewQueue.length} completed task${reviewQueue.length > 1 ? 's' : ''} need verification`,
      timestamp: now,
      type: 'review',
    });
  }

  return notifs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
