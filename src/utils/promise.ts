/**
 * Races a promise against a timeout. If the timeout fires first,
 * the returned promise rejects with `timeoutMessage`. This is used
 * to surface a meaningful error when Clerk's internal Turnstile /
 * CAPTCHA hangs silently instead of throwing (e.g. on preview domains).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage = 'Request timed out. Please refresh and try again.',
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), ms),
    ),
  ]);
}
