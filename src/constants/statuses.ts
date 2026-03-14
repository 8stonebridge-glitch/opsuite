import type { TaskStatus } from '../types';

export const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  Open: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'In Progress': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  Completed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Pending Approval': { bg: 'bg-amber-100', text: 'text-amber-700' },
  Verified: { bg: 'bg-gray-200', text: 'text-gray-600' },
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
