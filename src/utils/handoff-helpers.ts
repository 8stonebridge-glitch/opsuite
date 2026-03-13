import type { Task, AuditEntry, HandoffRecord, HandoffTaskSummary } from '../types';
import { getToday } from './date';

/**
 * Get active tasks for the handoff gate (assigned to userId, status Open or In Progress).
 */
export function getActiveTasksForHandoff(tasks: Task[], userId: string): Task[] {
  return tasks.filter(
    (t) => t.assigneeId === userId && (t.status === 'Open' || t.status === 'In Progress')
  );
}

/**
 * Check if the user has engaged with a specific task today.
 * Engagement = any audit entry today by this user with an actionable updateType.
 */
const ENGAGEMENT_TYPES = new Set([
  'Status',
  'Progress Update',
  'Note',
  'No Change',
  'Rework',
  'Assignment',
  'Approval',
  'Verification',
]);

export function hasEngagedToday(
  taskId: string,
  userId: string,
  audit: AuditEntry[],
  today: string
): boolean {
  return audit.some(
    (a) =>
      a.taskId === taskId &&
      a.dateTag === today &&
      ENGAGEMENT_TYPES.has(a.updateType)
  );
}

/**
 * Compute handoff progress: total active tasks, how many engaged today, remaining list.
 */
export function getHandoffProgress(
  tasks: Task[],
  userId: string,
  audit: AuditEntry[]
): { total: number; engaged: number; remaining: Task[] } {
  const today = getToday();
  const activeTasks = getActiveTasksForHandoff(tasks, userId);
  const remaining: Task[] = [];
  let engaged = 0;

  for (const task of activeTasks) {
    if (hasEngagedToday(task.id, userId, audit, today)) {
      engaged++;
    } else {
      remaining.push(task);
    }
  }

  return { total: activeTasks.length, engaged, remaining };
}

/**
 * Check if handoff can be completed: all active tasks engaged OR no active tasks.
 */
export function canCompleteHandoff(
  tasks: Task[],
  userId: string,
  audit: AuditEntry[]
): boolean {
  const { remaining } = getHandoffProgress(tasks, userId, audit);
  return remaining.length === 0;
}

/**
 * Build the HandoffRecord from current engagement state.
 */
export function buildHandoffSummary(
  tasks: Task[],
  userId: string,
  audit: AuditEntry[]
): HandoffRecord {
  const today = getToday();
  const activeTasks = getActiveTasksForHandoff(tasks, userId);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const tasksSummary: HandoffTaskSummary[] = activeTasks.map((task) => {
    // Check if the task had a "No Change" event today (vs an actual update)
    const noChangeToday = audit.some(
      (a) => a.taskId === task.id && a.dateTag === today && a.updateType === 'No Change'
    );
    return {
      taskId: task.id,
      action: noChangeToday ? 'noChange' as const : 'update' as const,
    };
  });

  return {
    userId,
    date: today,
    completedAt: time,
    tasksSummary,
    type: activeTasks.length > 0 ? 'tasks_reviewed' : 'no_tasks',
  };
}
