/**
 * Best-effort package-name detection from the Play Console page.
 *
 * This is the only place in Pinto that reads Google's DOM, and it is
 * deliberately optional: if it finds nothing, the panel asks the user to type
 * the package name once and caches it. Nothing breaks when Play Console
 * changes — the feature just degrades from "already filled in" to "type it
 * once", which is why the price-writing path never depends on scraping.
 */

const PACKAGE_PATTERN =
  /\b([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){1,6})\b/g;

/** Domains that show up in Play Console chrome and are never package names. */
const NOISE = [
  'play.google.com',
  'google.com',
  'gstatic.com',
  'googleapis.com',
  'schema.org',
  'w3.org',
  'youtube.com',
  'firebase.google.com',
];

export function sniffPackageName(root: Document = document): string | null {
  return fromCopyTargets(root) ?? fromText(root);
}

/**
 * Play Console renders the package name in a few "copyable" affordances
 * (tooltips, aria labels, copy buttons). These are far more reliable than
 * scanning text, so they are tried first.
 */
function fromCopyTargets(root: Document): string | null {
  const selectors = [
    '[aria-label*="package name" i]',
    '[title*="package name" i]',
    '[data-package-name]',
  ];
  for (const selector of selectors) {
    for (const element of root.querySelectorAll(selector)) {
      const raw =
        element.getAttribute('data-package-name') ??
        element.getAttribute('aria-label') ??
        element.getAttribute('title') ??
        element.textContent ??
        '';
      const candidate = firstPackageIn(raw);
      if (candidate) return candidate;
    }
  }
  return null;
}

function fromText(root: Document): string | null {
  // The package name appears near the app header; scanning the whole body is
  // both slow and noisy, so only the top of the document is considered.
  const scope =
    root.querySelector('header') ??
    root.querySelector('[role="banner"]') ??
    root.body;
  if (!scope) return null;
  return firstPackageIn(collectText(scope, 20_000));
}

/**
 * `textContent` glues adjacent elements together, so a heading followed by the
 * package name reads as "My Appcom.example.app" and the leading segment is
 * lost. Walking the text nodes and joining them with a space keeps element
 * boundaries visible to the matcher.
 */
function collectText(scope: Element, limit: number): string {
  const walker = scope.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let length = 0;
  while (walker.nextNode() && length < limit) {
    const value = walker.currentNode.nodeValue?.trim();
    if (!value) continue;
    parts.push(value);
    length += value.length + 1;
  }
  return parts.join(' ');
}

export function firstPackageIn(text: string): string | null {
  PACKAGE_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PACKAGE_PATTERN)) {
    const candidate = match[1]!;
    if (NOISE.some((noise) => candidate === noise || candidate.endsWith(`.${noise}`))) continue;
    if (candidate.split('.').length < 2) continue;
    // Filenames and CSS-ish tokens sneak in otherwise.
    if (/\.(js|css|png|svg|json|html|woff2?)$/.test(candidate)) continue;
    return candidate;
  }
  return null;
}
