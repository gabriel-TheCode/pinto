/**
 * English is the source of truth: its key set defines `TranslationKey`, so any
 * other locale that misses a key fails to compile. That is deliberate — a
 * half-translated interface on a tool that writes prices is worse than an
 * untranslated one, because the gaps land unpredictably.
 */
export const en = {
  // --- Navigation and shell -------------------------------------------------
  'nav.pricing': 'Pricing',
  'nav.strategy': 'Strategy',
  'nav.presets': 'Presets',
  'nav.history': 'History',
  'nav.settings': 'Settings',
  'nav.guide': 'Guide',
  'app.tagline': 'Bulk pricing, without the bulk work.',
  'app.account': 'Account',
  'app.signOut': 'Sign out',

  // --- Common actions -------------------------------------------------------
  'action.cancel': 'Cancel',
  'action.clear': 'Clear',
  'action.retry': 'Retry',
  'action.dismiss': 'Dismiss',
  'action.reviewChanges': 'Review changes',
  'action.backToCountries': 'Back to countries',
  'action.selectAllVisible': 'Select all visible',
  'action.done': 'Done',
  'action.save': 'Save',

  // --- Pricing screen -------------------------------------------------------
  'pricing.searchPlaceholder': 'Search countries, codes, currencies',
  'pricing.allCurrencies': 'All currencies',
  'pricing.resetFilters': 'Reset filters',
  'pricing.shownSelected': '{shown} shown · {selected} selected',
  'pricing.countriesSelected': '{count} countries selected',
  'pricing.countrySelected': '1 country selected',
  'pricing.willChange': '{count} will change',
  'pricing.needAttention': '{count} need attention',
  'pricing.noMatch': 'No countries match',
  'pricing.noMatchBody': 'Try a different search, or reset the filters.',

  // --- Settings -------------------------------------------------------------
  'settings.language': 'Language',
  'settings.languageHint': 'Applies to the Pinto panel only. Google Play stays in its own language.',
  'settings.account': 'Account',
  'settings.thisApp': 'This app',
  'settings.storage': 'What Pinto stores',
  'settings.log': 'Operation log',
  'settings.keyboard': 'Keyboard',

  // --- Guide ----------------------------------------------------------------
  'guide.title': 'How Pinto works',
  'guide.intro':
    'Google Play can set one price for every country, or make you edit them one at a time. Pinto is for everything in between — and it never writes anything until you have seen it.',
  'guide.beforeTitle': 'Before you start',
  'guide.before1': 'You need a Play Console account that can edit prices, and the Play Developer API enabled for the Google Cloud project linked to it.',
  'guide.before2': 'Pinto reads and writes through that API using your own Google account. Prices go straight from this panel to Google — there is no Pinto server.',
  'guide.before3': 'Open a subscription, one-time product or pricing page in Play Console. Pinto picks up the product from the page automatically.',

  'guide.flowTitle': 'The four steps',
  'guide.step1Title': '1 · Pick the product',
  'guide.step1Body':
    'The selector at the top lists every subscription base plan and one-time product in the app. If you opened a product in Play Console, it is already chosen.',
  'guide.step2Title': '2 · Choose the countries',
  'guide.step2Body':
    'Everything is selected by default. Narrow it with the search box, the continent chips, the sub-region chips underneath them, or the currency filter. Click a row to toggle one country. Save a selection you reuse as a group.',
  'guide.step3Title': '3 · Choose a strategy',
  'guide.step3Body':
    'The strategy decides the new price for every selected country. Prices update live in the table as you change it — nothing is sent yet.',
  'guide.step4Title': '4 · Review, then apply',
  'guide.step4Body':
    'Review splits the result into Changing, Warnings, Blocked and Unchanged. Read Blocked first: those countries are excluded from the write, with the reason. Then apply.',

  'guide.strategiesTitle': 'Which strategy to use',
  'guide.stratPercentage': 'Percentage — move every selected price by the same percentage. Use it for an across-the-board rise.',
  'guide.stratMultiplier': 'Multiplier — the same thing expressed as a factor. 1.2 raises by a fifth.',
  'guide.stratFixed': 'Fixed price — one target price, converted into every market’s currency. Same value everywhere.',
  'guide.stratCopy': 'Copy from — take one market’s current price and propagate it, converted.',
  'guide.stratTiers': 'Tiers — charge less where people earn less. This is the one Play Console cannot do.',
  'guide.stratFormula': 'Formula — write the arithmetic yourself, e.g. min(current * 1.15, 19.99).',

  'guide.zoneTitle': 'Pricing by economic zone',
  'guide.zoneBody':
    'Open Strategy → Tiers. Pinto starts you on a ladder across five purchasing-power bands, built from the markets your product actually sells in.',
  'guide.zone1': 'Set the anchor — the reference price the whole ladder is a share of.',
  'guide.zone2': 'Pick how steep it is: Flat, Gentle, Balanced or Aggressive. The resulting price per band is previewed before you generate.',
  'guide.zone3': 'Edit anything. Change a band’s percentage, click a band’s market count to see its countries, and remove any country that does not belong.',
  'guide.zoneCaveat':
    'The bands come from World Bank income groups and GNI per capita at PPP, adjusted for observed app-store spend. It is a starting point to argue with, not a measurement — check it before you apply it.',

  'guide.safetyTitle': 'Safety',
  'guide.safety1': 'Dry run records the operation in History without sending anything to Google. Use it the first time.',
  'guide.safety2': 'Changing more than 25 countries asks you to type the number to confirm.',
  'guide.safety3': 'Every applied operation stores the prices as they were. History → Restore puts them back.',
  'guide.safety4': 'For subscriptions, a new price applies to new subscribers. Existing subscribers keep theirs until you run a price change in Play Console, which has its own notice rules.',

  'guide.troubleTitle': 'Common messages',
  'guide.troubleNotAvailable':
    '“X is not an available country for this base plan” — the product is not sold there. Add the country in Play Console first; Pinto cannot create markets.',
  'guide.troubleRegionsVersion':
    '“Priced in EUR but Pinto asked for BGN” — a country recently changed currency. Reload the prices and try again; Pinto fetches the current regions version from Google.',
  'guide.troubleNoRate':
    '“Cannot convert” — that market has no price yet, so there is no rate to convert through. Give it a price in Play Console, or use a strategy that does not convert.',
  'guide.troubleBlocked':
    'Blocked rows are never written. Everything else in the batch still applies.',

  'guide.shortcutsTitle': 'Keyboard',
  'guide.scOpen': 'Open or close Pinto',
  'guide.scSearch': 'Focus the country search',
  'guide.scSelectAll': 'Select or clear all visible countries',
  'guide.scReview': 'Review changes',
  'guide.scClose': 'Close the panel',
  'guide.panelTitle': 'Moving the panel',
  'guide.panelBody':
    'Drag the title bar to move it, or dock it left or right with the arrows. The ▾ button collapses it to the title bar so you can reach Play Console underneath. Drag an edge to resize.',
} as const;

export type TranslationKey = keyof typeof en;
