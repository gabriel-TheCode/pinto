# Publishing Pinto to the Chrome Web Store

Everything needed to submit, in the order it has to happen.

---

## Decide the authentication model first

This is the one decision that changes the amount of work, so make it before
anything else. Pinto needs the `androidpublisher` OAuth scope, which Google
classifies as **sensitive**.

### Option A — every user brings their own OAuth client (what Pinto does today)

Each user creates an OAuth client in their own Google Cloud project and pastes
the client ID into Pinto's setup screen.

- **No Google OAuth verification.** Each user's client stays in their own
  project, under their own consent screen.
- Publishable immediately; only the Chrome Web Store review applies.
- The access is theirs to grant and revoke, and no third party sits between a
  developer and their pricing.
- Cost: roughly ten minutes of setup per user, before they can do anything.

This is less absurd than it sounds for this audience — every Pinto user is an
Android developer who already has a Play Console and a linked Cloud project.
Several Play-adjacent developer tools ship exactly this way.

### Option B — one shared OAuth client, verified by Google

You own a single OAuth client; users just click "Continue with Google".

- Requires **Google OAuth verification**: a published privacy policy on a domain
  you own and have verified in Search Console, a demo video showing the scope in
  use, and a written justification. Expect **several weeks**, with back-and-forth.
- Until verification passes, the consent screen is limited to **100 test users**
  you add by hand. Everyone else is refused.
- Also requires the extension ID to be fixed, which it is once published.

**Recommendation: ship Option A now, and start Option B in parallel if you want
the frictionless install later.** Option A gets Pinto usable by anyone this
week; B is a slow queue that does not block anything. Moving from A to B later
is a small change — the client ID becomes a constant instead of a setting.

---

## 1. Register as a Chrome Web Store developer

1. Go to <https://chrome.google.com/webstore/devconsole>.
2. Sign in and pay the **one-time 5 USD** registration fee.
3. Set your publisher display name — it appears on the listing.
4. Verify a contact email. Google requires this before a listing can go live.

## 2. Host the privacy policy

The store submission needs a **public URL**, not a file. `PRIVACY.md` in this
repository is the source, and the repository is public, so its file URL is the
answer:

```
https://github.com/gabriel-TheCode/pinto/blob/main/PRIVACY.md
```

Paste that into the listing's **Privacy policy URL** field, then open it in a
logged-out browser before submitting. A URL reviewers cannot load fails the
submission, and that is the only way this step goes wrong.

GitHub Pages is an alternative if you would rather serve a plain page than a
rendered Markdown file. It changes nothing about the policy itself.

Keep the policy and the manifest in step. `PRIVACY.md` names the exact scopes,
permissions and storage keys Pinto uses, so any change to `public/manifest.json`
that adds a permission is also a change to that file — and reviewers do compare
the two.

## 3. Build the upload artefact

```bash
npm run package
```

Writes `release/pinto-<version>.zip` with `manifest.json` at the archive root,
which is what the Web Store expects.

## 4. Create the listing and get the extension ID

1. Devconsole → **Add new item** → upload the ZIP.
2. Do **not** submit yet. Save the draft.
3. Copy the **Item ID** shown on the draft — this is the permanent extension ID.

The published ID differs from the unpacked one, so the OAuth redirect URI must
be updated for it:

```
https://<item-id>.chromiumapp.org/
```

Add that URI to the OAuth client (yours under Option B; each user's under
Option A — Pinto shows them the exact URI with a copy button on its sign-in
screen, so nothing has to be documented for them).

## 5. Fill in the store listing

| Field | Value |
| --- | --- |
| Category | Developer Tools |
| Language | English |
| Single purpose | Bulk editing of Google Play product prices across countries |

**Short description** (132 char max — the manifest description is already within
the limit and is reused):

> Bulk pricing, without the bulk work. Edit Google Play regional prices across every country from one review-before-apply workflow.

**Detailed description** — the README's "What it does" section is written for
this; paste it and trim the API discussion.

**Graphics required:**

- Store icon 128×128 — `dist/icons/icon-128.png`
- At least one screenshot, 1280×800 or 640×400. Take the panel open on a Play
  Console pricing page, and the Review screen showing changed rows. Two or three
  screenshots convert better than one.
- Small promo tile 440×280 — optional but it is what shows in search results.

## 6. Justify the permissions

The submission form asks for a written reason per permission and refuses vague
answers. Use these:

| Item | Justification |
| --- | --- |
| `storage` | Stores the user's own pricing presets, operation history with price snapshots for undo, and settings, locally in the browser. Nothing is transmitted. |
| `identity` | Runs the Google OAuth flow so the user can authorise access to their own Google Play Developer API data. |
| `play.google.com/console/*` | The extension's entire interface is injected into Play Console monetisation pages, and the current URL identifies which app and product the user is editing. |
| `androidpublisher.googleapis.com/*` | The Google Play Developer API, used to read and write the user's product prices. This is the extension's core function. |
| `openidconnect.googleapis.com/*` | Reads the signed-in user's name, email and avatar to display which account is connected. |
| Remote code | **None.** All code is bundled in the package. |
| Data usage | Tick: authentication information, website content. Then confirm the three certifications — Pinto sells nothing, transfers nothing, and uses data only for the user's own stated purpose. |

## 7. Submit

Review is typically a few days; extensions requesting sensitive host
permissions can take longer. A rejection arrives by email with a specific
policy clause — fix and resubmit rather than appealing.

---

## Releasing an update

1. Bump `version` in `public/manifest.json`. The Web Store rejects a re-upload
   at an existing version.
2. `npm test && npm run package`
3. Devconsole → the item → **Package** → upload the new ZIP → submit.

Version numbers only ever go up, and a published version cannot be replaced —
only superseded.

## Before every submission

```bash
npm test && npm run typecheck && npm run package
```

- [ ] `version` bumped in `public/manifest.json`
- [ ] Privacy policy URL reachable by a logged-out visitor
- [ ] Redirect URI on the OAuth client matches the published extension ID
- [ ] Screenshots show the current UI, not an older build
- [ ] Nothing from `private/` is staged — your own presets are pricing strategy,
      and the repository is public
