/**
 * Words shared by several screens: actions, counts, product vocabulary,
 * strategy names and operation statuses. A term defined here is the one used
 * everywhere, so a button and the help text that mentions it always agree.
 */
export const common = {
  'app.name': 'Pinto',
  'app.tagline': 'Bulk pricing for Google Play',

  'action.cancel': 'Cancel',
  'action.back': 'Back',
  'action.next': 'Next',
  'action.close': 'Close',
  'action.retry': 'Try again',
  'action.dismiss': 'Dismiss',
  'action.done': 'Done',
  'action.save': 'Save',
  'action.delete': 'Delete',
  'action.remove': 'Remove',
  'action.copy': 'Copy',
  'action.copied': 'Copied',
  'action.exportCsv': 'Export CSV',
  'action.reload': 'Reload',
  'action.clear': 'Clear',
  'action.confirm': 'Confirm',
  'action.showAll': 'Show all',
  'action.showLess': 'Show less',
  'action.openPlayConsole': 'Open Play Console',

  'state.loading': 'Loading…',
  'state.none': 'None',

  'count.countries': { one: '{count} country', other: '{count} countries' },
  'count.products': { one: '{count} product', other: '{count} products' },
  'count.prices': { one: '{count} price', other: '{count} prices' },

  'product.kind.subscription': 'Subscription',
  'product.kind.onetime': 'One-time product',
  'product.kind.inapp': 'Managed product (legacy)',
  'product.group.subscription': 'Subscriptions',
  'product.group.onetime': 'One-time products',
  'product.group.inapp': 'Managed products (legacy)',
  'product.option.buy': 'buy',
  'product.option.rent': 'rent',
  'product.state.draft': 'draft',
  'product.state.inactive': 'inactive',
  'product.state.inactive_publishable': 'inactive',
  'product.state.state_unspecified': 'unknown state',

  'period.year': { one: '{count} year', other: '{count} years' },
  'period.month': { one: '{count} month', other: '{count} months' },
  'period.week': { one: '{count} week', other: '{count} weeks' },
  'period.day': { one: '{count} day', other: '{count} days' },

  'strategy.percentage.name': 'Percentage',
  'strategy.percentage.blurb': 'Raise or lower every price by the same percentage.',
  'strategy.multiplier.name': 'Multiplier',
  'strategy.multiplier.blurb': 'Multiply every price by a factor.',
  'strategy.fixed.name': 'Fixed price',
  'strategy.fixed.blurb': 'One price, converted into each country’s currency.',
  'strategy.copy.name': 'Copy a country',
  'strategy.copy.blurb': 'Use one country’s current price everywhere, converted.',
  'strategy.tiers.name': 'Purchasing power',
  'strategy.tiers.blurb': 'Charge less where people earn less, tier by tier.',
  'strategy.formula.name': 'Formula',
  'strategy.formula.blurb': 'Write the calculation yourself.',

  'strategy.summary.percentage': '{delta} on current prices',
  'strategy.summary.multiplier': '× {factor} on current prices',
  'strategy.summary.fixed': '{price} in every country',
  'strategy.summary.fixedConverted': '{price}, converted per country',
  'strategy.summary.copy': '{country}’s price in every country',
  'strategy.summary.copyConverted': '{country}’s price, converted',
  'strategy.summary.tiers': {
    one: '{count} tier from {country}',
    other: '{count} tiers from {country}',
  },
  'strategy.summary.formula': 'Formula {expression}',
  'strategy.summary.revert': 'Previous prices restored',
  'strategy.summary.legacy': '{label}',

  'operation.status.succeeded': 'Updated',
  'operation.status.partial': 'Partly updated',
  'operation.status.failed': 'Not updated',
  'operation.status.unverified': 'Not confirmed',
  'operation.status.dry-run': 'Simulation',
  'operation.reverted': 'Restored',

  // Where converted prices come from, wherever converted prices are shown.
  'conversion.google': 'Converted with Google Play’s exchange rates',
  'conversion.loading': 'Getting Google’s exchange rates…',
  'conversion.fallback':
    'Estimated from this product’s own prices (Google’s rates unavailable)',

  'a11y.selected': 'selected',
  'a11y.external': '(opens in a new tab)',
} as const;
