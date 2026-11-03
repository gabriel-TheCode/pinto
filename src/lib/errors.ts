import type { PintoErrorPayload } from '@/services/messages';

/**
 * A single error type, identified by a stable `code`.
 *
 * The code and its `params` are what the interface shows — translated, with a
 * next step — so an error raised in the service worker reads in the user's
 * language in the panel. `message` is the English technical description kept
 * for the operation log and for tests; it is never shown as the headline.
 * Raw API payloads go in `detail`, behind "Technical details".
 */
export class PintoError extends Error {
  readonly code: string;
  readonly params?: Record<string, string | number>;
  readonly detail?: string;
  readonly retryable: boolean;

  constructor(init: {
    code: string;
    message: string;
    params?: Record<string, string | number>;
    detail?: string;
    retryable?: boolean;
  }) {
    super(init.message);
    this.name = 'PintoError';
    this.code = init.code;
    if (init.params !== undefined) this.params = init.params;
    if (init.detail !== undefined) this.detail = init.detail;
    this.retryable = init.retryable ?? false;
  }

  toPayload(): PintoErrorPayload {
    const payload: PintoErrorPayload = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.params) payload.params = this.params;
    if (this.detail) payload.detail = this.detail;
    return payload;
  }
}

export function toPayload(error: unknown): PintoErrorPayload {
  if (error instanceof PintoError) return error.toPayload();
  return {
    code: 'unexpected',
    message: 'Something went wrong inside Pinto.',
    detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    retryable: true,
  };
}

export const ERRORS = {
  notSignedIn: () =>
    new PintoError({ code: 'auth/not-signed-in', message: 'You are not signed in.' }),
  noClientId: () =>
    new PintoError({
      code: 'auth/no-client-id',
      message: 'Pinto needs a Google OAuth client ID before it can sign in.',
    }),
  sessionExpired: () =>
    new PintoError({ code: 'auth/expired', message: 'Your session has expired.', retryable: true }),
  noPackageName: () =>
    new PintoError({
      code: 'context/no-package',
      message: 'Pinto could not work out which app this page belongs to.',
    }),
  apiForbidden: (detail?: string) =>
    new PintoError({
      code: 'api/forbidden',
      message: 'Google Play refused the request for this app.',
      ...(detail ? { detail } : {}),
    }),
  /** `what` is technical (ids), so it travels as detail, not as wording. */
  apiNotFound: (what: string) =>
    new PintoError({
      code: 'api/not-found',
      message: `Google Play could not find ${what}.`,
      detail: what,
    }),
  network: (detail?: string) =>
    new PintoError({
      code: 'api/network',
      message: 'Could not reach the Google Play Developer API.',
      ...(detail ? { detail } : {}),
      retryable: true,
    }),
  operationNotFound: () =>
    new PintoError({ code: 'history/not-found', message: 'That operation is no longer in history.' }),
  noSnapshot: () =>
    new PintoError({
      code: 'history/no-snapshot',
      message: 'That operation has no price snapshot to restore.',
    }),
} as const;
