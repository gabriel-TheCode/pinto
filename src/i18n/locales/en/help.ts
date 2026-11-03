/**
 * The in-app guide. Labels of controls are never written here: they come in
 * as `{params}` from the keys the controls themselves use, so the guide and
 * the interface cannot disagree.
 */
export const help = {
  'help.intro.title': 'What Pinto does',
  'help.intro.body':
    'Google Play lets you set one price and convert it, or edit countries one at a time. Pinto does everything in between: it changes one product’s prices in many countries at once, shows every new price before anything is applied, and can restore the previous prices.',

  'help.before.title': 'Before you start',
  'help.before.permission': 'Your Google account needs permission to manage this app’s prices in Play Console.',
  'help.before.api':
    'The Google Play Developer API must be enabled in your Google Cloud project, and that project linked to your Play Console account under <b>Setup → API access</b>.',
  'help.before.page':
    'Open a subscription or a one-time product in Play Console, then open Pinto: it picks up the product from the page.',

  'help.steps.title': 'The three steps',
  'help.steps.intro':
    'Every price change goes through the same three steps, shown at the top of the panel. The button at the bottom always names what comes next.',
  'help.steps.strategy':
    'Decide how prices change. The step opens at {zero}, so nothing changes until you choose. Then press <b>{next}</b>.',
  'help.steps.markets':
    'Every country the product is sold in starts selected. Search and filters only change which countries you see, never which ones change. Then press <b>{next}</b>.',
  'help.steps.review':
    'Check every new price, country by country. Warnings are explained, and blocked countries never change. Simulate first if you like, then apply.',

  'help.strategies.title': 'Choosing a change',
  'help.strategy.percentage':
    'Moves every price by the same percentage — the usual choice for a rise or a cut across the board. Countries keep their price levels relative to each other.',
  'help.strategy.fixed':
    'One price in the reference country, converted into each country’s currency with Google’s rates. The same value everywhere.',
  'help.strategy.tiers':
    'Charges less where incomes are lower: countries are grouped by purchasing power, and each tier pays a share of an anchor price. Explained below.',
  'help.strategy.copy': 'Takes one country’s current price and uses it everywhere, converted into each currency.',
  'help.strategy.multiplier': 'A percentage written as a factor: × {factor} raises every price by {share}.',
  'help.strategy.formula':
    'Write the calculation yourself, such as <code>min(current * 1.15, 19.99)</code>. <code>current</code> is the country’s price today; <code>base</code> is the reference country’s price, converted into the country’s currency.',

  'help.tiers.body':
    'Pinto groups countries into {count} tiers by income and app spending. The anchor price is what the top tier pays; every other tier pays a share of it. Pick a curve to set the shares, then adjust any tier or move a country to another one.',
  'help.tiers.bands': 'The tiers',
  'help.tiers.curves': 'The curves',
  'help.tiers.floor': 'The lowest tier pays {share} of the anchor price.',
  'help.tiers.basis': 'Where the tiers come from',

  'help.safety.title': 'Safety',
  'help.safety.review':
    'Nothing is applied before the <b>{review}</b> step, and then only to the selected countries whose price changes.',
  'help.safety.simulate':
    'A simulation runs the same checks and is recorded in <b>{history}</b> without sending anything to Google. Use one the first time.',
  'help.safety.typed': 'Writing to {count} countries or more asks you to type the number of countries to confirm.',
  'help.safety.restore':
    'Every operation keeps the previous prices. In <b>{history}</b>, the <b>{restore}</b> button shows each country’s current and previous price, leaves out countries edited since unless you include them, and restores the rest.',
  'help.safety.verify':
    'After applying, Pinto reads the prices back from Google. A country whose price does not match is reported, and the operation is marked “{partial}” — or “{unverified}” if the read-back itself failed.',
  'help.safety.subscribers':
    'For subscriptions, a new price applies to new subscribers. Existing subscribers keep theirs until you migrate them to the new price in Play Console, which has its own notice rules.',

  'help.messages.title': 'Common messages',
  'help.messages.intro':
    'What some messages mean and what to do about them. The same advice appears with the message itself.',
  'help.messages.quote': '“{text}”',

  'help.panel.title': 'Panel window and keyboard',
  'help.panel.body':
    'The bar above the panel has four buttons: <b>{left}</b>, <b>{right}</b>, <b>{float}</b>, and <b>{collapse}</b> to fold Pinto down to its bar and reach the page underneath. Drag the bar to move a floating window; drag the inner edge of a docked panel, or the corner of a floating one, to resize it.',
} as const;
