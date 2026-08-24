import { ERRORS, PintoError } from '@/lib/errors';
import { log } from './logger';
import { storage, type StoredProfile, type StoredToken } from './storage';
import type { AuthState } from './messages';

const SCOPES = [
  'https://www.googleapis.com/auth/androidpublisher',
  'openid',
  'email',
  'profile',
].join(' ');

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

/** Refresh a little before expiry so a long apply never dies mid-flight. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

/**
 * OAuth via `chrome.identity.launchWebAuthFlow` using the implicit flow.
 *
 * Why implicit rather than authorization-code: the code flow for a Google
 * "Web application" client needs a client secret, and a secret shipped inside
 * an extension is not a secret. Implicit returns only a short-lived access
 * token, so Pinto never holds a refresh token and never writes a credential to
 * disk. When the token expires, `interactive: false` silently mints a new one
 * from the user's existing Google session with no UI.
 */
export const auth = {
  async getState(): Promise<AuthState> {
    const [token, profile, clientId] = await Promise.all([
      storage.getToken(),
      storage.getProfile(),
      storage.getClientId(),
    ]);
    const valid = !!token && token.expiresAt > Date.now();
    return {
      signedIn: valid,
      email: valid ? (profile?.email ?? null) : null,
      name: valid ? (profile?.name ?? null) : null,
      picture: valid ? (profile?.picture ?? null) : null,
      expiresAt: valid ? token.expiresAt : null,
      clientIdConfigured: !!clientId,
    };
  },

  async signIn(): Promise<AuthState> {
    const token = await obtainToken({ interactive: true });
    await storage.setToken(token);
    await storage.setProfile(await fetchProfile(token.accessToken));
    log.info('auth', 'Signed in');
    return auth.getState();
  },

  async signOut(): Promise<AuthState> {
    await Promise.all([storage.setToken(null), storage.setProfile(null)]);
    log.info('auth', 'Signed out');
    return auth.getState();
  },

  /**
   * Returns a usable access token, refreshing silently if needed.
   * Throws `auth/expired` when a silent refresh is not possible so the UI can
   * show "sign in again" rather than a raw API failure.
   */
  async getAccessToken(): Promise<string> {
    const existing = await storage.getToken();
    if (existing && existing.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
      return existing.accessToken;
    }
    try {
      const token = await obtainToken({ interactive: false });
      await storage.setToken(token);
      return token.accessToken;
    } catch (error) {
      if (error instanceof PintoError && error.code === 'auth/no-client-id') throw error;
      log.warn('auth', 'Silent token refresh failed', error);
      await storage.setToken(null);
      throw ERRORS.sessionExpired();
    }
  },
};

async function obtainToken(opts: { interactive: boolean }): Promise<StoredToken> {
  const clientId = await storage.getClientId();
  if (!clientId) throw ERRORS.noClientId();

  const redirectUri = chrome.identity.getRedirectURL();
  const state = crypto.randomUUID();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('include_granted_scopes', 'true');
  if (!opts.interactive) url.searchParams.set('prompt', 'none');

  const responseUrl = await launch(url.toString(), opts.interactive);
  const params = parseFragment(responseUrl);

  if (params.get('error')) {
    throw new PintoError({
      code: 'auth/denied',
      message: 'Google did not grant access.',
      hint: 'Make sure you approve the Play Developer API permission when signing in.',
      detail: params.get('error_description') ?? params.get('error') ?? undefined,
    });
  }
  if (params.get('state') !== state) {
    throw new PintoError({
      code: 'auth/state-mismatch',
      message: 'Sign-in response did not match the request.',
      hint: 'Try signing in again.',
      retryable: true,
    });
  }

  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in') ?? 3600);
  if (!accessToken) {
    throw new PintoError({
      code: 'auth/no-token',
      message: 'Google did not return an access token.',
      hint: 'Try signing in again.',
      retryable: true,
    });
  }

  return {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: params.get('scope') ?? SCOPES,
  };
}

function launch(url: string, interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (responseUrl) => {
      const error = chrome.runtime.lastError;
      if (error || !responseUrl) {
        reject(
          new PintoError({
            code: interactive ? 'auth/cancelled' : 'auth/silent-failed',
            message: interactive
              ? 'Sign-in did not complete.'
              : 'Could not refresh the session silently.',
            // Chrome reports a closed window and a Google error page the same
            // way, so the likeliest non-obvious cause is named here rather
            // than leaving "cancelled" to look like the user's own doing.
            hint: interactive
              ? 'If you closed the window, just try again. If Google showed an error instead, the redirect URI on your OAuth client probably does not match the one below.'
              : undefined,
            detail: error?.message,
            retryable: true,
          }),
        );
        return;
      }
      resolve(responseUrl);
    });
  });
}

function parseFragment(responseUrl: string): URLSearchParams {
  const hashIndex = responseUrl.indexOf('#');
  const queryIndex = responseUrl.indexOf('?');
  if (hashIndex >= 0) return new URLSearchParams(responseUrl.slice(hashIndex + 1));
  if (queryIndex >= 0) return new URLSearchParams(responseUrl.slice(queryIndex + 1));
  return new URLSearchParams();
}

async function fetchProfile(accessToken: string): Promise<StoredProfile> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return { email: null, name: null, picture: null };
    const body = (await response.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    return {
      email: body.email ?? null,
      name: body.name ?? null,
      picture: body.picture ?? null,
    };
  } catch {
    return { email: null, name: null, picture: null };
  }
}

export { SCOPES };
