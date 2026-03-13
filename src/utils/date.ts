export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getNowISO(): string {
  return new Date().toISOString();
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate) return false;
  if (status === 'Verified' || status === 'Completed') return false;
  return dueDate < getToday();
}

export function formatDue(date: string | null): string | null {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function diffDays(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function dueLabel(dueDate: string | null, status: string): { text: string; urgent: boolean } | null {
  if (!dueDate) return null;
  if (status === 'Verified' || status === 'Completed') return { text: formatDue(dueDate) || dueDate, urgent: false };
  const days = diffDays(getToday(), dueDate);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, urgent: true };
  if (days === 0) return { text: 'Due today', urgent: true };
  if (days === 1) return { text: 'Due tomorrow', urgent: false };
  if (days <= 7) return { text: `${days}d left`, urgent: false };
  return { text: formatDue(dueDate) || dueDate, urgent: false };
}
