/** Step 3: review before applying, the write in progress, and its outcome. */
export const review = {
  'review.title': 'Review before applying',

  'review.rates.loading.title': 'Getting Google Play’s exchange rates…',
  'review.rates.loading.body': 'So the prices you review are exactly the ones applied.',
  'review.rates.fallback.title': 'Prices are estimated from this product’s own prices',
  'review.rates.fallback.body':
    'Google’s exchange rates could not be loaded, so each conversion uses the rate implied by this product’s current prices. Try again for exact rates.',

  'review.stat.changing': 'Changing',
  'review.stat.range': 'Range',
  'review.stat.rangeValue': '{min} to {max}',
  'review.stat.blocked': 'Blocked',
  'review.stat.unchanged': 'Unchanged',

  'review.blocked.title': {
    one: '{count} country is blocked and will not change',
    other: '{count} countries are blocked and will not change',
  },
  'review.blocked.body': 'Everything else still applies. Each blocked row says why.',
  'review.blocked.show': 'Show blocked countries',

  'review.check.title': { one: '{count} price to check', other: '{count} prices to check' },
  'review.check.body':
    'They move by an unusual amount, or Pinto is unsure how their currency is written. Check them before applying.',
  'review.check.show': 'Show them',
  'review.check.confirm': {
    one: 'I have checked the price marked “To check”',
    other: 'I have checked the {count} prices marked “To check”',
  },

  'review.subscription.title': 'Existing subscribers keep their price',
  'review.subscription.body':
    'New prices apply to new subscribers. Existing subscribers keep theirs until you migrate them to the new price in Play Console, which has its own notice and consent rules.',

  'review.filter.label': 'Show',
  'review.filter.changing': 'Changing',
  'review.filter.check': 'To check',
  'review.filter.blocked': 'Blocked',
  'review.filter.unchanged': 'Unchanged',

  'review.row.price': 'Was {current}, now {next}',
  'review.row.kept': 'Stays at {current}',

  'review.empty.changing.title': 'No price changes',
  'review.empty.changing.body': 'The change you chose leaves every selected country at its current price.',
  'review.empty.check.title': 'Nothing to check',
  'review.empty.check.body': 'No price moves by an unusual amount.',
  'review.empty.blocked.title': 'Nothing is blocked',
  'review.empty.blocked.body': 'Every selected country has a valid new price.',
  'review.empty.unchanged.title': 'Every selected price changes',
  'review.empty.unchanged.body': 'No selected country keeps its current price.',

  'review.simulate': 'Simulate',
  'review.simulate.hint':
    'Simulate records the operation in History without sending anything to Google Play.',
  'review.apply': { one: 'Apply to {count} country', other: 'Apply to {count} countries' },
  'review.confirm.title': { one: 'Apply {count} new price?', other: 'Apply {count} new prices?' },
  'review.confirm.body':
    'For {product} ({package}). Google Play is updated immediately; you can restore the previous prices afterwards from the result or from History.',
  'review.confirm.type': 'Type {number} to confirm',

  'review.status.changed': 'Changing',
  'review.status.unchanged': 'Unchanged',
  'review.status.invalid': 'Blocked',
  'review.status.skipped': 'Not selected',

  'review.csv.code': 'Country code',
  'review.csv.country': 'Country',
  'review.csv.currency': 'Currency',
  'review.csv.current': 'Current price',
  'review.csv.new': 'New price',
  'review.csv.change': 'Change (%)',
  'review.csv.status': 'Status',
  'review.csv.notes': 'Notes',
  'review.csv.reason': 'Reason',
  'review.csv.hint': 'What to do',
  'review.csv.detail': 'Google Play’s message',

  'review.progress.title': 'Updating prices',
  'review.progress.titleRevert': 'Restoring previous prices',
  'review.progress.phase.preparing': 'Reading the current prices',
  'review.progress.phase.writing': {
    one: 'Sending {count} price to Google Play',
    other: 'Sending {count} prices to Google Play',
  },
  'review.progress.phase.isolating': 'Google Play refused part of the batch — finding which countries',
  'review.progress.phase.verifying': 'Checking that the new prices are live',
  'review.progress.rejected': {
    one: '{count} country refused so far',
    other: '{count} countries refused so far',
  },
  'review.progress.state.done': 'Done:',
  'review.progress.state.current': 'In progress:',
  'review.progress.state.pending': 'To do:',
  'review.progress.count': '{completed} of {total}',
  'review.progress.note': 'Keep this tab open until it finishes. You can scroll Play Console meanwhile.',

  'review.result.succeeded.title': 'Prices updated',
  'review.result.restored.title': 'Previous prices restored',
  'review.result.succeeded.body': {
    one: '{count} country confirmed by reading it back from Google Play.',
    other: '{count} countries confirmed by reading them back from Google Play.',
  },
  'review.result.partial.title': {
    one: '{ok} of {count} country updated',
    other: '{ok} of {count} countries updated',
  },
  'review.result.partial.body': {
    one: '{count} country was not updated. The reason is below.',
    other: '{count} countries were not updated. The reason for each is below.',
  },
  'review.result.failed.title': 'No price was changed',
  'review.result.failed.body': 'Google Play did not accept this change. The reason for each country is below.',
  'review.result.unverified.title': {
    one: 'Google Play accepted {count} price, but Pinto could not read it back to confirm',
    other: 'Google Play accepted {count} prices, but Pinto could not read them back to confirm',
  },
  'review.result.unverified.body':
    'Check the prices in Play Console, or reload this product in a few minutes to see whether they landed.',
  'review.result.dryRun.title': 'Simulation — nothing was sent to Google Play',
  'review.result.dryRun.body': {
    one: '{count} price would change.',
    other: '{count} prices would change.',
  },
  'review.result.reloadHint': 'Play Console shows the old prices until you reload its page.',
  'review.result.failures': {
    one: '{count} country not updated',
    other: '{count} countries not updated',
  },
  'review.result.applyForReal': 'Apply for real',
  'review.result.reviewFailed': 'Review failed countries',
  'review.result.retryRestore': 'Retry the restore',
  'review.result.undo': 'Undo this change',
  'review.result.undo.title': {
    one: 'Restore the previous price of {count} country?',
    other: 'Restore the previous prices of {count} countries?',
  },
  'review.result.undo.body':
    'Each country goes back to the price it had before this change. Google Play is updated immediately.',
  'review.result.retry.title': {
    one: 'Try restoring {count} country again?',
    other: 'Try restoring {count} countries again?',
  },
  'review.result.retry.body':
    'These countries go back to the price they had before the original change. Google Play is updated immediately.',
  'review.result.restoreConfirm': { one: 'Restore {count} price', other: 'Restore {count} prices' },
  'review.result.restoreRow': 'From {current} back to {previous}',
} as const;
