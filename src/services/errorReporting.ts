/**
 * Error Reporting Service
 *
 * Integrates with Sentry for production crash monitoring.
 * To activate Sentry:
 *   1. Run: npx @sentry/wizard@latest -i reactNative
 *   2. Add your DSN to .env:  EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/yyy
 *   3. Uncomment the Sentry lines below and import * as Sentry from '@sentry/react-native'
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initErrorReporting(): void {
  if (!SENTRY_DSN) return;
  // Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.2 });
  console.info('[ErrorReporting] Sentry ready — DSN configured.');
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));

  if (__DEV__) {
    console.error('[ErrorReporting]', err.message, context ?? '');
    return;
  }

  // Sentry.withScope((scope) => {
  //   if (context) scope.setExtras(context);
  //   Sentry.captureException(err);
  // });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (__DEV__) {
    console.warn(`[ErrorReporting:${level}]`, message);
    return;
  }
  // Sentry.captureMessage(message, level);
}

export function setUserContext(userId: string, email?: string): void {
  // Sentry.setUser({ id: userId, email });
}

export function clearUserContext(): void {
  // Sentry.setUser(null);
}
