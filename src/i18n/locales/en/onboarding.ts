/**
 * Everything before the workspace: connecting Pinto to Google Play, naming the
 * app, and finding a page with prices on it. Read by people who have never
 * seen Pinto, so every step says what to do and where.
 */
export const onboarding = {
  // Setup: no OAuth client yet
  'onboarding.setup.title': 'Connect Pinto to Google Play',
  'onboarding.setup.lead':
    'Pinto signs in through an OAuth client in your own Google Cloud project, so the access is yours to grant and revoke. Five steps, once — about five minutes.',
  'onboarding.setup.stepsLabel': 'Setup steps',

  'onboarding.setup.api.title': 'Enable the Google Play Android Developer API',
  'onboarding.setup.api.body':
    'In Google Cloud, pick or create a project, then enable the API for it.',
  'onboarding.setup.api.link': 'Open the API page',

  'onboarding.setup.consent.title': 'Set up the OAuth consent screen',
  'onboarding.setup.consent.body':
    'Choose <b>External</b>. Leaving it in testing is fine: add your own Google account as a test user.',
  'onboarding.setup.consent.link': 'Open the consent screen',

  'onboarding.setup.client.title': 'Create an OAuth client',
  'onboarding.setup.client.body':
    'Choose the type <b>Web application</b>, and add this address under <b>Authorised redirect URIs</b>:',
  'onboarding.setup.client.link': 'Create the client',

  'onboarding.setup.link.title': 'Link the project to Play Console',
  'onboarding.setup.link.body':
    'In Play Console, open <b>Setup → API access</b> and link the same Cloud project. Without it, Google Play refuses Pinto’s requests even after you sign in.',

  'onboarding.setup.paste.title': 'Paste the client ID',
  'onboarding.setup.paste.body':
    'Google shows it when the client is created. You can also find it in the client’s details.',

  'onboarding.redirect.label': 'Redirect URI',
  'onboarding.redirect.copy': 'Copy the redirect URI',

  // Client ID field
  'onboarding.clientId.label': 'OAuth client ID',
  'onboarding.clientId.placeholder': '1234567890-abc.apps.googleusercontent.com',
  'onboarding.clientId.invalid':
    'This is not a client ID. It ends in .apps.googleusercontent.com — check you copied the client ID, not the secret.',
  'onboarding.clientId.save': 'Save client ID',
  'onboarding.clientId.saved': 'Client ID saved. You can sign in now.',
  'onboarding.clientId.change': 'Change OAuth client ID',

  // Setup: client configured
  'onboarding.signIn.lead':
    'Change a product’s prices in every country at once, and check each one before anything is applied.',
  'onboarding.signIn.action': 'Sign in with Google',
  'onboarding.privacy':
    'There is no Pinto server: Pinto talks to Google directly from your browser. It asks for the <code>androidpublisher</code> scope to read and update prices, and for your email and name to show which account is connected. The access token stays in memory for this browser session only.',

  'onboarding.language.label': 'Language',
  'onboarding.language.auto': 'Automatic',

  // Package name
  'onboarding.package.title': 'Which app is this?',
  'onboarding.package.why':
    'Play Console calls this app <code>#{id}</code> in its address, but the Google Play Developer API needs its package name. Pinto asks once and remembers it for this app.',
  'onboarding.package.whereTitle': 'Where to find it',
  'onboarding.package.whereDashboard': 'On the app’s dashboard in Play Console, under the app name.',
  'onboarding.package.whereStore': 'In the app’s Play Store address, after <code>id=</code>.',
  'onboarding.package.label': 'Package name',
  'onboarding.package.placeholder': 'com.example.app',
  'onboarding.package.invalid':
    'This is not a package name. It looks like com.example.app: lowercase words separated by dots.',
  'onboarding.package.submit': 'Continue',

  // Not a pricing page
  'onboarding.unsupported.title': 'Open a product’s prices',
  'onboarding.unsupported.body':
    'Pinto works next to the prices it edits: a subscription, a one-time product or the app’s pricing page in Play Console.',
  'onboarding.unsupported.howTitle': 'To get there',
  'onboarding.unsupported.how1': 'In Play Console, open your app.',
  'onboarding.unsupported.how2': 'Go to <b>Monetise with Play → Products</b>.',
  'onboarding.unsupported.how3': 'Open a subscription or a one-time product.',
  'onboarding.unsupported.check': 'Check again',
  'onboarding.unsupported.still': 'This tab is still not a product’s pricing page.',
} as const;
