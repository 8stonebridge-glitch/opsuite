import type { TaskStatus } from '../types';

export const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  Open: { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400' },
  'In Progress': { bg: 'bg-indigo-100 dark:bg-indigo-950', text: 'text-indigo-700 dark:text-indigo-400' },
  Completed: { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400' },
  'Pending Approval': { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400' },
  Verified: { bg: 'bg-gray-200 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
};

export const STATUS_SHORT: Partial<Record<TaskStatus, string>> = {
  'Pending Approval': 'Pending',
  'In Progress': 'Active',
};

/** Map internal status values to user-facing display labels.
 *  The internal value (e.g. "In Progress") is kept for data/backend;
 *  this map provides the label shown in every UI surface.           */
export const STATUS_DISPLAY: Record<TaskStatus, string> = {
  Open: 'Open',
  'In Progress': 'Active',
  Completed: 'Completed',
  'Pending Approval': 'Pending Approval',
  Verified: 'Verified',
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  medium: '#d97706',
  low: '#059669',
};
