import type { PintoErrorPayload } from '@/services/messages';

/**
 * A single error type with a user-facing message and a separate technical
 * detail. Raw API payloads and stack traces never reach the main UI; they go
 * to the operation log, which the user can open deliberately.
 */
export class PintoError extends Error {
  readonly code: string;
  readonly hint?: string;
  readonly detail?: string;
  readonly retryable: boolean;

  constructor(init: {
    code: string;
    message: string;
    hint?: string;
    detail?: string;
    retryable?: boolean;
  }) {
    super(init.message);
    this.name = 'PintoError';
    this.code = init.code;
    if (init.hint !== undefined) this.hint = init.hint;
    if (init.detail !== undefined) this.detail = init.detail;
    this.retryable = init.retryable ?? false;
  }

  toPayload(): PintoErrorPayload {
    const payload: PintoErrorPayload = {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
    if (this.hint) payload.hint = this.hint;
    if (this.detail) payload.detail = this.detail;
    return payload;
  }
}

export function toPayload(error: unknown): PintoErrorPayload {
  if (error instanceof PintoError) return error.toPayload();
  return {
    code: 'unexpected',
    message: 'Something went wrong inside Pinto.',
    hint: 'Try again. If it keeps happening, open the operation log for details.',
    detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    retryable: true,
  };
}

export const ERRORS = {
  notSignedIn: () =>
    new PintoError({
      code: 'auth/not-signed-in',
      message: 'You are not signed in.',
      hint: 'Sign in with the Google account that has access to this Play Console app.',
    }),
  noClientId: () =>
    new PintoError({
      code: 'auth/no-client-id',
      message: 'Pinto needs a Google OAuth client ID before it can sign in.',
      hint: 'Open Pinto settings and paste the OAuth client ID for your Google Cloud project.',
    }),
  sessionExpired: () =>
    new PintoError({
      code: 'auth/expired',
      message: 'Your session has expired.',
      hint: 'Sign in again to continue.',
      retryable: true,
    }),
  noPackageName: () =>
    new PintoError({
      code: 'context/no-package',
      message: 'Pinto could not work out which app this page belongs to.',
      hint: 'Enter the package name once — Pinto remembers it for this app.',
    }),
  apiForbidden: (detail?: string) =>
    new PintoError({
      code: 'api/forbidden',
      message: 'Google Play refused the request for this app.',
      hint: 'Check that the Play Developer API is enabled, that your Cloud project is linked to this Play Console account, and that your account has permission to edit prices.',
      ...(detail ? { detail } : {}),
    }),
  apiNotFound: (what: string) =>
    new PintoError({
      code: 'api/not-found',
      message: `Google Play could not find ${what}.`,
      hint: 'It may have been renamed or deleted. Reload the page and try again.',
    }),
  network: (detail?: string) =>
    new PintoError({
      code: 'api/network',
      message: 'Could not reach the Google Play Developer API.',
      hint: 'Check your connection and retry.',
      ...(detail ? { detail } : {}),
      retryable: true,
    }),
} as const;
