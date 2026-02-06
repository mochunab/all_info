import { NextRequest } from 'next/server';

/**
 * Verify cron/server-to-server auth via Bearer token.
 * Checks Authorization header against CRON_SECRET env var.
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[AUTH] CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Verify same-origin request (CSRF defense).
 * Checks that origin or referer header matches the host.
 * Allows requests with no origin (e.g. server-side, curl).
 */
export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (!host) return false;

  // If origin header is present, verify it matches host
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  // Fall back to referer check
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // No origin or referer — non-browser request (cron, curl)
  // These should be authenticated via verifyCronAuth instead
  return false;
}
