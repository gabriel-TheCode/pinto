# Pinto — Privacy Policy

_Last updated: 3 November 2026_

Pinto is a Chrome extension that edits Google Play product prices in bulk. This
policy describes every piece of data it touches.

## The short version

Pinto has **no server**. There is no Pinto backend, no analytics, no telemetry
and no third-party service. Your data goes from your browser to Google and
nowhere else. Nothing is ever sold, shared or transmitted to the developer.

## What Pinto accesses

**Your Google account, with your permission.** Signing in grants Pinto an OAuth
access token for these scopes:

| Scope | Why |
| --- | --- |
| `https://www.googleapis.com/auth/androidpublisher` | Read and update the prices of your own Play Console products |
| `openid`, `email`, `profile` | Show which account is connected, in Pinto's Settings and its toolbar popup |

**Your Play Console product data.** Product ids, base plans, purchase options,
regional prices and currencies — read from, and written to, the Google Play
Developer API.

**The Play Console page you are on.** Pinto reads the current tab's URL to work
out which app and product you are looking at. It reads the page itself only to
attempt to find the app's package name (if that fails it asks you to type it)
and to find the price table its launcher is placed beside. Nothing read from the
page is stored except the package name you confirm.

## What Pinto stores, and where

All storage is local to your browser. None of it is transmitted anywhere.

**`chrome.storage.local` — persists on your machine**

- The OAuth client ID you configure
- Pricing presets you save
- Operation history, for your 50 most recent operations, simulations included:
  the change you applied and when, the prices as they were immediately before
  each write (this is what makes Restore possible), the prices each write asked
  for (so a restore can skip countries edited since), and, for any country that
  was not updated, the reason, including Google's own message
- A map of Play Console's internal app id to the package name you confirmed
- Custom country groups you create
- Your settings: the interface language (Automatic, English or French), the
  last change you applied and when, so Pinto can offer it again, and the
  warnings you closed, each recorded as the app's package name and an error
  code so it stays closed
- A technical log of API operations. It records region codes, product ids, API
  status codes and Google's error messages. Pinto does not write prices into
  it, though an error message from Google may quote one.

**Play Console's page storage (`localStorage` on play.google.com)**

- The position, size and docking of Pinto's window, so it reopens where you
  left it. Nothing else.

**`chrome.storage.session` — memory only, erased when Chrome closes**

- The OAuth access token
- Your name, email address and avatar URL, to show which account is connected
  in Settings and in the toolbar popup

Pinto never requests and never stores an OAuth refresh token, and no credential
is ever written to disk.

## What Pinto sends, and to whom

Only to Google, only these:

- `androidpublisher.googleapis.com` — reading and writing your product prices,
  and asking Google to convert a reference price into local currencies
- `accounts.google.com` — the sign-in flow
- `openidconnect.googleapis.com` — retrieving your name, email and avatar
- Google's image servers (`googleusercontent.com`) — loading your profile
  picture, shown in Settings

The developer of Pinto receives nothing. There is no endpoint to receive it.

## Deleting your data

Removing the extension from `chrome://extensions` deletes everything Pinto
stored in `chrome.storage`. The window layout kept in Play Console's page
storage goes when you clear site data for play.google.com. You can also clear
history at any time from **History** in the panel header, delete presets and
groups where you use them, and revoke Pinto's access to your Google account at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Save the settings, presets and history listed above |
| `identity` | Run the Google sign-in flow |
| `https://play.google.com/console/*` | Show Pinto's panel on Play Console pages and read the current route |
| `https://androidpublisher.googleapis.com/*` | The Google Play Developer API |
| `https://openidconnect.googleapis.com/*` | Read your name, email and avatar after sign-in |

Pinto requests no broad host permission, no `tabs` permission, and executes no
remotely hosted code.

## Changes

Any change to this policy will be published in this file in the project
repository, with the date above updated.

## Contact

Questions or requests: open an issue at
<https://github.com/gabriel-TheCode/pinto>.
