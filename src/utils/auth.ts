// ── Simple local-only auth helpers (no backend) ──────────────────────

export function hashPassword(plain: string): string {
  let hash = 0;
  for (let i = 0; i < plain.length; i++) {
    hash = ((hash << 5) - hash + plain.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash));
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
  return password.length >= 6;
}
