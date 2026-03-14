// ── Shared utilities for Convex functions ──────────────────────────

export function getNowISO(): string {
  return new Date().toISOString();
}

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
