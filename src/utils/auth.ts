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

export function splitName(fullName: string): {
  firstName: string;
  lastName?: string;
} {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || undefined,
  };
}

export function getAuthErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (
    error &&
    typeof error === 'object' &&
    'errors' in error &&
    Array.isArray((error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors)
  ) {
    const first = (error as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
