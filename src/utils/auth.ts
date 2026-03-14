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
  const normalizeAuthMessage = (message: string) => {
    const normalized = message.trim().toLowerCase();

    if (
      normalized.includes('user email already exists') ||
      normalized.includes('email already exists') ||
      normalized.includes('user already exists') ||
      normalized.includes('already registered') ||
      normalized.includes('already in use') ||
      normalized.includes('already been used')
    ) {
      return 'An account already exists for that email. Sign in instead or use another email address.';
    }

    return message;
  };

  if (
    error &&
    typeof error === 'object' &&
    'errors' in error &&
    Array.isArray((error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors)
  ) {
    const first = (error as { errors: Array<{ longMessage?: string; message?: string }> }).errors[0];
    if (first?.longMessage) return normalizeAuthMessage(first.longMessage);
    if (first?.message) return normalizeAuthMessage(first.message);
  }

  if (error instanceof Error && error.message) {
    return normalizeAuthMessage(error.message);
  }

  return fallback;
}
