/** Settings: language, account, the app being priced, the Google connection, diagnostics. */
export const settings = {
  'settings.language.title': 'Language',
  'settings.language.description':
    'Applies to every Pinto surface: this panel, the toolbar popup and the launcher on Play Console pages. Google Play keeps its own language.',
  'settings.language.label': 'Show Pinto in',
  'settings.language.auto': 'Automatic',
  'settings.language.browser': 'Follows your browser’s language: {language}.',

  'settings.account.title': 'Account',
  'settings.account.token':
    'Your access token is valid until {time} and renews by itself. It is kept in memory for this browser session only, never written to disk.',
  'settings.account.signOut': 'Sign out',

  'settings.app.title': 'This app',
  'settings.app.description': 'Pinto reads and writes prices only for this package name.',
  'settings.app.package': 'Package name',
  'settings.app.invalid':
    'Use the app’s package name, such as com.example.app: lowercase letters, digits and underscores, in two or more parts separated by dots.',
  'settings.app.source.page': 'Read from the Play Console page — check it is the right app.',
  'settings.app.source.cache': 'Remembered on this machine for this app.',
  'settings.app.source.manual': 'Entered by you.',
  'settings.app.source.url': 'Read from the page address.',
  'settings.app.consoleId': 'Play Console app ID: {id}.',
  'settings.app.noConsoleId': 'Open an app in Play Console to change its package name.',
  'settings.app.saved': 'Package name saved: {package}',

  'settings.cloud.title': 'Google Cloud connection',
  'settings.cloud.description': 'Pinto signs in through an OAuth client in your own Google Cloud project.',
  'settings.cloud.clientId': 'OAuth client ID',
  'settings.cloud.placeholder': '1234567890-abc.apps.googleusercontent.com',
  'settings.cloud.invalid': 'An OAuth client ID ends with .apps.googleusercontent.com.',
  'settings.cloud.hint': 'Saving a different client ID signs you out.',
  'settings.cloud.confirmTitle': 'Change the OAuth client ID?',
  'settings.cloud.confirmBody':
    'You will be signed out, then sign in again through the new client. Your presets and history are kept.',
  'settings.cloud.confirm': 'Save and sign out',
  'settings.cloud.redirect': 'Authorised redirect URI',
  'settings.cloud.redirectHint': 'Add it to your OAuth client in Google Cloud exactly as shown.',
  'settings.cloud.copyRedirect': 'Copy URI',

  'settings.storage.title': 'What Pinto stores',
  'settings.storage.machine':
    'On this machine: your OAuth client ID, settings, presets and groups, the operation history with its price snapshots, which package name belongs to which Play Console app, and a technical log.',
  'settings.storage.session':
    'In memory for this browser session only: the access token, and your name, email and picture.',
  'settings.storage.nowhere':
    'Nowhere else. Pinto has no server: prices go straight from this panel to the Google Play Developer API.',

  'settings.log.title': 'Diagnostics',
  'settings.log.description':
    'A technical log of what Pinto did, to attach to a bug report. Its lines are technical and stay in English.',
  'settings.log.load': 'Load technical log',
  'settings.log.label': 'Technical log',
  'settings.log.empty': 'The log is empty.',
  'settings.log.copy': 'Copy log',

  'settings.keys.title': 'Keyboard shortcuts',
  'settings.keys.shortcut': 'Shortcut',
  'settings.keys.action': 'Action',
  'settings.keys.toggle': 'Open or close Pinto on a Play Console page',
  'settings.keys.search': 'Search countries',
  'settings.keys.selectAll': 'Select all shown countries',
  'settings.keys.next': 'Continue, or apply on the Review step',
  'settings.keys.close': 'Close a dialog, or the panel',
  'settings.keys.shift': 'Shift',
  'settings.keys.esc': 'Esc',

  'settings.about.title': 'About {app}',
  'settings.about.version': 'Version {version}',
} as const;
