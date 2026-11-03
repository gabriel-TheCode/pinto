/**
 * The toolbar popup: is Pinto connected, can it work on this tab, and the one
 * action that gets the user there.
 */
export const popup = {
  'popup.checking': 'Checking this tab…',

  'popup.account': 'Account',
  'popup.account.signedIn': 'Signed in',
  'popup.account.signedOut': 'Not signed in',
  'popup.tab': 'This tab',
  'popup.tab.pricing': 'Pricing page',
  'popup.tab.console': 'Play Console, not a pricing page',
  'popup.tab.other': 'Not Play Console',
  'popup.app': 'App',

  'popup.open': 'Open Pinto',
  'popup.consoleHint':
    'Open a subscription, a one-time product or the app’s pricing page, and Pinto picks it up.',
  'popup.otherHint': 'Pinto edits prices from inside Play Console.',
  'popup.shortcut.mac': 'On a pricing page, you can also press <kbd>⇧P</kbd>.',
  'popup.shortcut.other': 'On a pricing page, you can also press <kbd>Shift+P</kbd>.',

  'popup.stale.title': 'Reload this tab to finish setting up Pinto',
  'popup.stale.body': 'This tab was open before Pinto was installed or updated.',
  'popup.stale.action': 'Reload tab',
} as const;
