# Pinto — Privacy Policy

_Last updated: 24 August 2026_

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
| `openid`, `email`, `profile` | Show which account is connected in the panel header |

**Your Play Console product data.** Product ids, base plans, purchase options,
regional prices and currencies — read from, and written to, the Google Play
Developer API.

**The Play Console page you are on.** Pinto reads the current tab's URL to work
out which app and product you are looking at. It reads the page itself only to
attempt to find the app's package name; if that fails it asks you to type it.

## What Pinto stores, and where

All storage is local to your browser. None of it is transmitted anywhere.

**`chrome.storage.local` — persists on your machine**

- The OAuth client ID you configure
- Pricing presets you save
- Operation history: what you applied, when, and the prices as they were
  immediately before each write (this is what makes Undo possible)
- A map of Play Console's internal app id to the package name you confirmed
- Custom country groups you create
- Your settings, including the panel language
- A technical log of API operations. It records region codes, product ids and
  API status codes. **It does not record prices.**

**`chrome.storage.session` — memory only, erased when Chrome closes**

- The OAuth access token
- Your name, email address and avatar URL, to display in the header

Pinto never requests and never stores an OAuth refresh token, and no credential
is ever written to disk.

## What Pinto sends, and to whom

Only to Google, only these:

- `androidpublisher.googleapis.com` — reading and writing your product prices,
  and asking Google to convert a reference price into local currencies
- `accounts.google.com` — the sign-in flow
- `openidconnect.googleapis.com` — retrieving your name, email and avatar

The developer of Pinto receives nothing. There is no endpoint to receive it.

## Deleting your data

Removing the extension from `chrome://extensions` deletes everything Pinto
stored. You can also clear history from the History tab at any time, and revoke
Pinto's access to your Google account at
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
