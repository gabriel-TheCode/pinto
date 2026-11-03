/**
 * Every error Pinto can raise, as a headline and a next step. Keys mirror the
 * error code (`api/forbidden` → `error.api.forbidden`), so a code added in the
 * worker without wording here fails the dictionary test.
 */
export const errors = {
  'error.generic.title': 'Something went wrong',
  'error.generic.hint':
    'Try again. If it keeps happening, copy the technical details from Settings → Diagnostics.',
  'error.details': 'Technical details',

  'error.auth.not-signed-in.title': 'You are signed out',
  'error.auth.not-signed-in.hint':
    'Sign in with the Google account that can edit prices for this app.',
  'error.auth.no-client-id.title': 'Pinto is not connected to Google yet',
  'error.auth.no-client-id.hint': 'Add your OAuth client ID, then sign in.',
  'error.auth.expired.title': 'Your session has expired',
  'error.auth.expired.hint': 'Sign in again to continue. Nothing was changed.',
  'error.auth.denied.title': 'Google did not grant access',
  'error.auth.denied.hint':
    'Sign in again and allow the Google Play Developer API permission when Google asks.',
  'error.auth.state-mismatch.title': 'The sign-in response did not match the request',
  'error.auth.state-mismatch.hint': 'Sign in again.',
  'error.auth.no-token.title': 'Google did not return an access token',
  'error.auth.no-token.hint': 'Sign in again.',
  'error.auth.cancelled.title': 'Sign-in did not finish',
  'error.auth.cancelled.hint':
    'If you closed the window, sign in again. If Google showed an error page, the redirect URI on your OAuth client probably does not match the one shown here.',
  'error.auth.silent-failed.title': 'Your session could not be renewed',
  'error.auth.silent-failed.hint': 'Sign in again.',

  'error.context.no-package.title': 'Pinto could not tell which app this page is for',
  'error.context.no-package.hint': 'Enter the package name once — Pinto remembers it for this app.',

  'error.api.forbidden.title': 'Google Play refused access to this app',
  'error.api.forbidden.hint':
    'Check that the Google Play Developer API is enabled, that your Cloud project is linked to this Play Console account (Setup → API access), and that your account can edit prices.',
  'error.api.not-found.title': 'Google Play could not find this product',
  'error.api.not-found.hint':
    'Check the package name and that the product still exists, then reload.',
  'error.api.network.title': 'Google Play could not be reached',
  'error.api.network.hint': 'Check your connection and try again.',
  'error.api.no-answer.title': 'Google Play did not answer',
  'error.api.no-answer.hint': 'Reload to try again.',
  'error.api.bad-response.title': 'Google Play sent a response Pinto could not read',
  'error.api.bad-response.hint': 'Try again in a moment.',
  'error.api.regions-version.title': '{region} is priced in {got}, not {expected}',
  'error.api.regions-version.hint':
    'A country recently changed currency. Reload the prices and try again — Pinto fetches the current regions version from Google.',
  'error.api.rejected.title': 'Google Play rejected the change',
  'error.api.rejected.hint': 'Google’s reason is in the technical details.',
  'error.api.conflict.title': 'The product changed while Pinto was updating it',
  'error.api.conflict.hint': 'Pinto has reloaded the current prices. Review them, then apply again.',
  'error.api.rate-limited.title': 'Google Play is limiting requests',
  'error.api.rate-limited.hint': 'Wait a minute, then try again.',
  'error.api.server.title': 'Google Play had a server error',
  'error.api.server.hint': 'This is usually temporary. Try again in a moment.',
  'error.api.http.title': 'Google Play answered with HTTP {status}',
  'error.api.http.hint': 'Google’s reason is in the technical details.',
  'error.api.region-not-configured.title': 'This product is not available in {region}',
  'error.api.region-not-configured.hint':
    'Add the country to the product in Play Console first, then price it with Pinto.',

  'error.apply.not-applied.title': 'Google accepted the price, but it did not change',
  'error.apply.not-applied.hint': 'Reload the prices and try this country again.',
  'error.apply.rejected.title': 'Google Play rejected this price',
  'error.apply.rejected.hint': 'Google’s reason is in the technical details.',
  'error.apply.stale.title': {
    one: 'A price changed since you loaded it',
    other: '{count} prices changed since you loaded them',
  },
  'error.apply.stale.hint':
    'This product was edited in the meantime, so nothing was applied. Pinto has reloaded the current prices: review them, then apply again.',
  'error.apply.busy.title': 'Another update is still running',
  'error.apply.busy.hint': 'Wait for it to finish, then try again.',

  'error.history.not-found.title': 'This operation is no longer in the history',
  'error.history.not-found.hint': 'The history keeps the last 50 operations.',
  'error.history.no-snapshot.title': 'There are no previous prices to restore',
  'error.history.no-snapshot.hint': 'Only applied operations keep a snapshot of the prices.',

  'error.runtime.disconnected.title': 'Pinto lost its connection to the extension',
  'error.runtime.disconnected.hint':
    'The extension was probably updated or reloaded. Reload the Play Console tab.',
  'error.runtime.no-response.title': 'The extension did not respond',
  'error.runtime.no-response.hint': 'Reload the Play Console tab.',

  'error.preset.invalid-json.title': 'This file is not valid JSON',
  'error.preset.invalid-json.hint': 'Choose a file exported from Pinto.',
  'error.preset.invalid-file.title': 'This file is not a Pinto preset file',
  'error.preset.invalid-file.hint': 'Problem at {path}. Choose a file exported from Pinto.',
} as const;
