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

export const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  medium: '#d97706',
  low: '#059669',
};
