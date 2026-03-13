import type { AvailabilityRecord, Task, Team, Employee, Role } from '../types';
import { isOverdue, diffDays } from './date';

/**
 * Get all availability records for a member on a specific date.
 */
export function availabilityForMemberOnDate(
  memberId: string,
  date: string,
  availability: AvailabilityRecord[]
): AvailabilityRecord[] {
  return availability.filter(
    (r) =>
      r.memberId === memberId &&
      r.startDate <= date &&
      r.endDate >= date &&
      r.status !== 'cancelled' &&
      r.status !== 'rejected'
  );
}

/**
 * Is a member protected-unavailable on a given date?
 * Protected = (leave+approved) OR (off_duty+approved) OR (sick+pending|approved)
 * Sick gets immediate protection even while pending.
 */
export function isProtectedUnavailable(
  memberId: string,
  date: string,
  availability: AvailabilityRecord[]
): boolean {
  const records = availabilityForMemberOnDate(memberId, date, availability);
  return records.some((r) => {
    if (r.type === 'sick' && (r.status === 'pending' || r.status === 'approved')) return true;
    if (r.type === 'leave' && r.status === 'approved') return true;
    if (r.type === 'off_duty' && r.status === 'approved') return true;
    return false;
  });
}

/**
 * Find the manager (approval authority) for a given member.
 * Returns the team lead's id, or 'admin' if the member IS the lead.
 */
export function approvalManagerForMember(
  memberId: string,
  teams: Team[]
): string {
  for (const team of teams) {
    if (team.lead.id === memberId) return 'admin';
    if (team.members.some((m) => m.id === memberId)) return team.lead.id;
  }
  return 'admin';
}

/**
 * Count available workdays for a member in a date range.
 * Subtracts protected-unavailable weekdays from total weekdays.
 */
export function availableWorkdays(
  memberId: string,
  startDate: string,
  endDate: string,
  availability: AvailabilityRecord[]
): number {
  let total = 0;
  let absent = 0;
  const d = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (d <= end) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) {
      total++;
      const dateStr = d.toISOString().split('T')[0];
      if (isProtectedUnavailable(memberId, dateStr, availability)) {
        absent++;
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return Math.max(0, total - absent);
}

/**
 * Tasks blocked by an employee's absence:
 * assignee is away AND (critical OR due within 48h OR overdue).
 */
export function tasksBlockedByAbsence(
  memberId: string,
  date: string,
  tasks: Task[],
  availability: AvailabilityRecord[]
): Task[] {
  if (!isProtectedUnavailable(memberId, date, availability)) return [];

  return tasks.filter((t) => {
    if (t.assigneeId !== memberId) return false;
    if (t.status === 'Verified' || t.status === 'Completed') return false;

    // Critical priority
    if (t.priority === 'critical') return true;
    // Overdue
    if (isOverdue(t.due, t.status)) return true;
    // Due within 48h
    if (t.due) {
      const days = diffDays(date, t.due);
      if (days >= 0 && days <= 2) return true;
    }
    return false;
  });
}

/**
 * Get all tasks needing coverage across the manager's scope.
 * For admin: all employees. For subadmin: team members only.
 */
export function coverageNeededTasksForScope(
  managerId: string | null,
  date: string,
  tasks: Task[],
  availability: AvailabilityRecord[],
  teams: Team[],
  role: Role
): Task[] {
  const employeeIds = getScopedEmployeeIds(managerId, teams, role);
  const blocked: Task[] = [];

  for (const empId of employeeIds) {
    blocked.push(...tasksBlockedByAbsence(empId, date, tasks, availability));
  }

  return blocked;
}

/**
 * Get pending availability requests visible to a manager.
 */
export function pendingAvailabilityRequestsForScope(
  managerId: string | null,
  availability: AvailabilityRecord[],
  teams: Team[],
  role: Role
): AvailabilityRecord[] {
  const employeeIds = getScopedEmployeeIds(managerId, teams, role);
  return availability.filter(
    (r) => r.status === 'pending' && employeeIds.includes(r.memberId)
  );
}

/**
 * Get employees who are away (protected-unavailable) today, scoped by role.
 */
export function awayTodayForScope(
  managerId: string | null,
  date: string,
  availability: AvailabilityRecord[],
  teams: Team[],
  allEmployees: Employee[],
  role: Role
): Employee[] {
  const employeeIds = getScopedEmployeeIds(managerId, teams, role);
  return allEmployees.filter(
    (emp) => employeeIds.includes(emp.id) && isProtectedUnavailable(emp.id, date, availability)
  );
}

/**
 * Get the active availability record for a member on a date (most specific one).
 * Returns the first protected record, or null.
 */
export function getActiveAvailability(
  memberId: string,
  date: string,
  availability: AvailabilityRecord[]
): AvailabilityRecord | null {
  const records = availabilityForMemberOnDate(memberId, date, availability);
  // Prefer approved, then pending sick
  const approved = records.find((r) => r.status === 'approved');
  if (approved) return approved;
  const pendingSick = records.find((r) => r.type === 'sick' && r.status === 'pending');
  if (pendingSick) return pendingSick;
  return records[0] || null;
}

// ── Internal helper ─────────────────────────────────────────────────

function getScopedEmployeeIds(
  managerId: string | null,
  teams: Team[],
  role: Role
): string[] {
  if (role === 'admin') {
    // All employees across all teams
    return teams.flatMap((t) => [t.lead.id, ...t.members.map((m) => m.id)]);
  }
  if (role === 'subadmin' && managerId) {
    const team = teams.find((t) => t.lead.id === managerId);
    if (team) return team.members.map((m) => m.id);
  }
  return [];
}
