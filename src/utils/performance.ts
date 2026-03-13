import type {
  Task,
  CheckIn,
  Team,
  ScoreBand,
  EmployeePerformanceMetrics,
  EmployeeActionItem,
  EmployeePerformance,
  SubadminPerformance,
  AvailabilityRecord,
} from '../types';
import { getToday, diffDays } from './date';
import { isProtectedUnavailable } from './availability-helpers';

// ── Band thresholds ──────────────────────────────────────────────────

function scoreToBand(score: number): ScoreBand {
  if (score >= 85) return 'green';
  if (score >= 70) return 'amber';
  return 'red';
}

// ── Date helpers ─────────────────────────────────────────────────────

function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Returns weekdays (Mon-Fri) within [start, end] inclusive */
function getWeekdaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  while (d <= endDate) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ── Manager lookup ───────────────────────────────────────────────────

export function managerForEmployee(employeeId: string, teams: Team[]): string {
  for (const team of teams) {
    if (team.lead.id === employeeId) return 'admin'; // leads report to owner
    if (team.members.some((m) => m.id === employeeId)) return team.lead.id;
  }
  return 'admin';
}

// ── Metric computation ──────────────────────────────────────────────

function computeMetrics(
  employeeId: string,
  tasks: Task[],
  checkIns: CheckIn[],
  windowStart: string,
  windowEnd: string,
  availability?: AvailabilityRecord[]
): EmployeePerformanceMetrics {
  const today = windowEnd;
  const empTasks = tasks.filter((t) => t.assigneeId === employeeId);

  // Active tasks (Open or In Progress)
  const activeTasks = empTasks.filter(
    (t) => t.status === 'Open' || t.status === 'In Progress'
  );
  // Overdue among active
  const overdueTasks = activeTasks.filter(
    (t) => t.due && t.due < today && t.status !== 'Verified' && t.status !== 'Completed'
  );
  const overdueRate = activeTasks.length > 0 ? overdueTasks.length / activeTasks.length : 0;

  // Stale: active tasks with no update for 48h
  const staleThreshold = offsetDate(today, -2);
  const staleActiveCount = activeTasks.filter((t) => {
    const lastUpdate = t.lastActivityAt || t.createdAt;
    return lastUpdate < staleThreshold;
  }).length;

  // On-time completion rate: tasks completed within window, completed by due date
  const completedTasks = empTasks.filter(
    (t) =>
      (t.status === 'Completed' || t.status === 'Verified') &&
      t.completedAt &&
      t.completedAt >= windowStart &&
      t.completedAt <= windowEnd
  );
  const onTimeTasks = completedTasks.filter(
    (t) => !t.due || (t.completedAt && t.completedAt <= t.due)
  );
  const onTimeCompletionRate =
    completedTasks.length > 0 ? onTimeTasks.length / completedTasks.length : 1;

  // Critical response rate: critical tasks created in window, started within 24h
  const criticalTasks = empTasks.filter(
    (t) => t.priority === 'critical' && t.createdAt >= windowStart && t.createdAt <= windowEnd
  );
  const respondedCritical = criticalTasks.filter((t) => {
    if (!t.startedAt) return false;
    return diffDays(t.createdAt.split('T')[0], t.startedAt.split('T')[0]) <= 1;
  });
  const criticalResponseRate =
    criticalTasks.length > 0 ? respondedCritical.length / criticalTasks.length : 1;

  // ── Discipline metrics ──

  // Check-in compliance: available weekdays in window where employee checked in
  const weekdays = getWeekdaysInRange(windowStart, windowEnd);
  // Filter out days employee was protected-unavailable
  const availableWeekdays = availability
    ? weekdays.filter((d) => !isProtectedUnavailable(employeeId, d, availability))
    : weekdays;
  const checkedInDates = new Set(
    checkIns
      .filter((c) => c.userId === employeeId && c.status === 'Checked-In')
      .map((c) => c.date)
  );
  const checkedWeekdays = availableWeekdays.filter((d) => checkedInDates.has(d));
  const checkInComplianceRate =
    availableWeekdays.length > 0 ? checkedWeekdays.length / availableWeekdays.length : 1;

  // Update consistency: % of in-progress tasks with lastActivityAt within last 48h
  const inProgressTasks = empTasks.filter((t) => t.status === 'In Progress');
  const recentlyUpdated = inProgressTasks.filter((t) => {
    const lastUpdate = t.lastActivityAt || t.createdAt;
    return lastUpdate >= staleThreshold;
  });
  const updateConsistencyRate =
    inProgressTasks.length > 0 ? recentlyUpdated.length / inProgressTasks.length : 1;

  // Rework rate: % of completed/verified tasks that were reworked
  const allFinished = empTasks.filter(
    (t) => t.status === 'Completed' || t.status === 'Verified'
  );
  const reworkedFinished = allFinished.filter((t) => t.reworked);
  const reworkRate =
    allFinished.length > 0 ? reworkedFinished.length / allFinished.length : 0;

  // Handoff response rate: tasks completed in window, moved to review (Completed/Pending Approval) within 24h of startedAt → completedAt
  // Simplified: if task has completedAt, check if it was within 24h of when it would normally be expected
  // Using: completed tasks in window — did they complete before or on due date?
  const handoffTasks = completedTasks.filter((t) => t.completedAt && t.startedAt);
  const fastHandoffs = handoffTasks.filter((t) => {
    if (!t.completedAt || !t.startedAt) return false;
    // Consider "good handoff" if completed within a reasonable time
    return true; // simplified — all completed tasks count as good handoff
  });
  const handoffResponseRate =
    handoffTasks.length > 0 ? fastHandoffs.length / handoffTasks.length : 1;

  return {
    overdueRate,
    staleActiveCount,
    onTimeCompletionRate,
    criticalResponseRate,
    checkInComplianceRate,
    updateConsistencyRate,
    reworkRate,
    handoffResponseRate,
  };
}

// ── Score formula ────────────────────────────────────────────────────

function computeScore(metrics: EmployeePerformanceMetrics): number {
  const execution =
    ((1 - metrics.overdueRate) * 100 +
      metrics.onTimeCompletionRate * 100 +
      metrics.criticalResponseRate * 100 +
      Math.max(0, 100 - metrics.staleActiveCount * 15)) /
    4;

  const discipline =
    (metrics.checkInComplianceRate * 100 +
      metrics.updateConsistencyRate * 100 +
      (1 - metrics.reworkRate) * 100 +
      metrics.handoffResponseRate * 100) /
    4;

  return Math.round(execution * 0.5 + discipline * 0.5);
}

// ── Action generation ───────────────────────────────────────────────

function generateActions(
  metrics: EmployeePerformanceMetrics,
  tasks: Task[],
  employeeId: string
): EmployeeActionItem[] {
  const actions: EmployeeActionItem[] = [];
  const empTasks = tasks.filter((t) => t.assigneeId === employeeId);
  const today = getToday();

  // Overdue cleanup
  const overdue = empTasks.filter(
    (t) =>
      t.due &&
      t.due < today &&
      t.status !== 'Verified' &&
      t.status !== 'Completed' &&
      (t.status === 'Open' || t.status === 'In Progress')
  );
  if (overdue.length > 0) {
    actions.push({
      id: `${employeeId}-overdue`,
      severity: 'red',
      label: 'Overdue cleanup',
      count: overdue.length,
      target: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
    });
  }

  // Stale tasks
  const staleThreshold = offsetDate(today, -2);
  const activeTasks = empTasks.filter(
    (t) => t.status === 'Open' || t.status === 'In Progress'
  );
  const stale = activeTasks.filter((t) => {
    const lastUpdate = t.lastActivityAt || t.createdAt;
    return lastUpdate < staleThreshold;
  });
  if (stale.length > 0) {
    actions.push({
      id: `${employeeId}-stale`,
      severity: 'amber',
      label: 'Stale task follow-up',
      count: stale.length,
      target: `${stale.length} task${stale.length > 1 ? 's' : ''} with no update in 48h`,
    });
  }

  // Check-in compliance
  if (metrics.checkInComplianceRate < 1) {
    const missedPct = Math.round((1 - metrics.checkInComplianceRate) * 100);
    actions.push({
      id: `${employeeId}-checkin`,
      severity: metrics.checkInComplianceRate < 0.7 ? 'red' : 'amber',
      label: 'Missed check-ins',
      count: missedPct,
      target: `${missedPct}% check-ins missed this week`,
    });
  }

  // Rework rate
  if (metrics.reworkRate > 0.2) {
    const reworkPct = Math.round(metrics.reworkRate * 100);
    actions.push({
      id: `${employeeId}-rework`,
      severity: metrics.reworkRate > 0.4 ? 'red' : 'amber',
      label: 'Repeated rework',
      count: reworkPct,
      target: `${reworkPct}% of tasks reworked`,
    });
  }

  // Update consistency
  if (metrics.updateConsistencyRate < 0.8) {
    const missingPct = Math.round((1 - metrics.updateConsistencyRate) * 100);
    actions.push({
      id: `${employeeId}-updates`,
      severity: 'amber',
      label: 'Missing progress updates',
      count: missingPct,
      target: `${missingPct}% of tasks missing updates`,
    });
  }

  // Sort by severity (red first)
  const severityOrder: Record<ScoreBand, number> = { red: 0, amber: 1, green: 2 };
  actions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return actions;
}

// ── Main: compute employee performance ──────────────────────────────

export function computeEmployeePerformance(
  employeeId: string,
  tasks: Task[],
  checkIns: CheckIn[],
  teams: Team[],
  availability?: AvailabilityRecord[]
): EmployeePerformance {
  const today = getToday();
  const windowEnd = today;
  const windowStart = offsetDate(today, -7);
  const prevWindowEnd = offsetDate(today, -8);
  const prevWindowStart = offsetDate(today, -14);

  const managerId = managerForEmployee(employeeId, teams);

  // Current window
  const metrics = computeMetrics(employeeId, tasks, checkIns, windowStart, windowEnd, availability);
  const score = computeScore(metrics);
  const band = scoreToBand(score);

  // Previous window for trend
  const prevMetrics = computeMetrics(employeeId, tasks, checkIns, prevWindowStart, prevWindowEnd, availability);
  const prevScore = computeScore(prevMetrics);
  const trendDelta = score - prevScore;

  // Actions
  const actions = generateActions(metrics, tasks, employeeId);

  return {
    employeeId,
    managerId,
    score,
    band,
    trendDelta,
    metrics,
    actions,
    windowStart,
    windowEnd,
  };
}

// ── Subadmin performance (team aggregate) ───────────────────────────

export function computeSubadminPerformance(
  teamId: string,
  tasks: Task[],
  checkIns: CheckIn[],
  teams: Team[],
  availability?: AvailabilityRecord[]
): SubadminPerformance {
  const today = getToday();
  const windowEnd = today;
  const windowStart = offsetDate(today, -7);
  const prevWindowEnd = offsetDate(today, -8);
  const prevWindowStart = offsetDate(today, -14);

  const team = teams.find((t) => t.id === teamId);
  if (!team) {
    return {
      subadminId: '',
      teamId,
      score: 0,
      band: 'red',
      trendDelta: 0,
      employeeScores: [],
      atRiskCount: 0,
      actions: [],
      windowStart,
      windowEnd,
    };
  }

  const subadminId = team.lead.id;
  const memberIds = team.members.map((m) => m.id);

  // Compute individual scores
  const employeeScores = memberIds.map((id) => {
    const perf = computeEmployeePerformance(id, tasks, checkIns, teams, availability);
    return { employeeId: id, score: perf.score, band: perf.band };
  });

  // Team average
  const avgScore =
    employeeScores.length > 0
      ? Math.round(employeeScores.reduce((s, e) => s + e.score, 0) / employeeScores.length)
      : 100;
  const band = scoreToBand(avgScore);

  // Trend: compute previous window avg
  const prevScores = memberIds.map((id) => {
    const prevMetrics = computeMetrics(id, tasks, checkIns, prevWindowStart, prevWindowEnd, availability);
    return computeScore(prevMetrics);
  });
  const prevAvg =
    prevScores.length > 0
      ? Math.round(prevScores.reduce((s, v) => s + v, 0) / prevScores.length)
      : 100;
  const trendDelta = avgScore - prevAvg;

  // At-risk count
  const atRiskCount = employeeScores.filter((e) => e.band !== 'green').length;

  // Aggregate worst actions from team
  const allPerfs = memberIds.map((id) =>
    computeEmployeePerformance(id, tasks, checkIns, teams, availability)
  );
  const actionMap = new Map<string, EmployeeActionItem>();
  for (const perf of allPerfs) {
    for (const action of perf.actions) {
      const key = action.label;
      const existing = actionMap.get(key);
      if (!existing || action.severity === 'red') {
        actionMap.set(key, {
          ...action,
          id: `team-${teamId}-${key}`,
          count: (existing?.count || 0) + action.count,
          target: `${(existing ? 1 : 0) + 1} team members affected`,
        });
      }
    }
  }
  const actions = Array.from(actionMap.values()).slice(0, 5);

  return {
    subadminId,
    teamId,
    score: avgScore,
    band,
    trendDelta,
    employeeScores,
    atRiskCount,
    actions,
    windowStart,
    windowEnd,
  };
}
