import type { CheckIn } from '../types';
import { getToday } from './date';

/** Returns an array of 7 date strings for the current week (Mon–Sun) */
export function getCurrentWeekDays(today?: string): string[] {
  const d = new Date(`${today || getToday()}T12:00:00`);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    days.push(day.toISOString().split('T')[0]);
  }
  return days;
}

/** Returns all dates in a given month */
export function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Format month label */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Returns day-of-week short label */
export function getDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
}

/** Returns day number from date string */
export function getDayNum(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDate();
}

export interface CheckInStats {
  checked: number;
  missed: number;
  percentage: number;
  currentStreak: number;
  longestStreak: number;
}

/** Compute check-in stats for a user, optionally scoped to a month */
export function computeCheckInStats(
  checkIns: CheckIn[],
  userId: string,
  year?: number,
  month?: number
): CheckInStats {
  const today = getToday();
  const userCheckIns = checkIns.filter((c) => c.userId === userId);

  // Determine date range
  let daysToCheck: string[];
  if (year !== undefined && month !== undefined) {
    daysToCheck = getMonthDays(year, month).filter((d) => d <= today);
  } else {
    // Current month
    const now = new Date();
    daysToCheck = getMonthDays(now.getFullYear(), now.getMonth()).filter((d) => d <= today);
  }

  // Filter to weekdays only (Mon-Fri)
  daysToCheck = daysToCheck.filter((d) => {
    const dow = new Date(`${d}T12:00:00`).getDay();
    return dow >= 1 && dow <= 5;
  });

  const checkedDates = new Set(
    userCheckIns.filter((c) => c.status === 'Checked-In').map((c) => c.date)
  );

  const checked = daysToCheck.filter((d) => checkedDates.has(d)).length;
  const missed = daysToCheck.length - checked;
  const percentage = daysToCheck.length > 0 ? Math.round((checked / daysToCheck.length) * 100) : 0;

  // Streaks (across all time, weekdays only)
  const allDates = getAllWorkdays(userId, userCheckIns);
  const { currentStreak, longestStreak } = calculateStreaks(allDates, checkedDates, today);

  return { checked, missed, percentage, currentStreak, longestStreak };
}

function getAllWorkdays(userId: string, checkIns: CheckIn[]): string[] {
  const today = getToday();
  // Go back 90 days for streak calculation
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const days: string[] = [];
  const d = new Date(start);
  while (d.toISOString().split('T')[0] <= today) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function calculateStreaks(
  workdays: string[],
  checkedDates: Set<string>,
  today: string
): { currentStreak: number; longestStreak: number } {
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (const day of workdays) {
    if (checkedDates.has(day)) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  // Current streak: count backwards from today (or last workday)
  currentStreak = 0;
  for (let i = workdays.length - 1; i >= 0; i--) {
    if (workdays[i] > today) continue;
    if (checkedDates.has(workdays[i])) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

/** Check-in status for a specific date */
export function getCheckInForDate(
  checkIns: CheckIn[],
  userId: string,
  date: string
): CheckIn | undefined {
  return checkIns.find((c) => c.userId === userId && c.date === date);
}

/** Format a date string to readable form */
export function formatCheckInDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
