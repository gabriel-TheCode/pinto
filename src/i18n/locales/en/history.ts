/** History: every operation, what it did, and putting prices back. */
export const history = {
  'history.loading': 'Loading history…',
  'history.empty.title': 'No operations yet',
  'history.empty.body':
    'Every change you apply or simulate is recorded here with the prices as they were before, so you can put them back.',
  'history.note': 'Kept on this machine only. Pinto keeps the last {max} operations.',
  'history.day.today': 'Today',
  'history.day.yesterday': 'Yesterday',

  'history.record.countries': {
    one: '{affected} of {count} country updated',
    other: '{affected} of {count} countries updated',
  },
  'history.record.simulated': {
    one: '{affected} of {count} country would change',
    other: '{affected} of {count} countries would change',
  },
  'history.record.failures': {
    one: '{count} country not updated',
    other: '{count} countries not updated',
  },

  'history.restore.action': 'Restore previous prices',
  'history.restore.undoRestore': 'Undo this restore',
  'history.restore.title': 'Restore previous prices?',
  'history.restore.description': '{product} goes back to the prices it had before {when}.',
  'history.restore.confirm': { one: 'Restore {count} price', other: 'Restore {count} prices' },
  'history.restore.col.country': 'Country',
  'history.restore.col.now': 'Now',
  'history.restore.col.restored': 'Restored',
  'history.restore.row.skipped': 'Changed since · skipped',
  'history.restore.row.overwritten': 'Changed since · overwritten',
  'history.restore.drift.title': {
    one: '{count} country changed since this operation',
    other: '{count} countries changed since this operation',
  },
  'history.restore.drift.body':
    'Their price is no longer the one this operation left — it was edited later, in Pinto or in Play Console. They are skipped so that later change is kept.',
  'history.restore.drift.include': {
    one: 'Also overwrite the country changed since',
    other: 'Also overwrite the {count} countries changed since',
  },
  'history.restore.noCheck':
    'This operation is older than Pinto’s check for later edits. Compare the current prices before restoring.',
  'history.restore.nothing':
    'Every country changed since this operation, so there is nothing to restore unless you overwrite them.',
  'history.restore.typePrompt': 'Type {count} to confirm',
  'history.restore.otherApp.title': 'This operation was on {package}',
  'history.restore.otherApp.body':
    'That is not the app open now: the prices are restored in that app, not in this one.',
  'history.restore.otherProduct.title': {
    one: '{count} price will be restored',
    other: '{count} prices will be restored',
  },
  'history.restore.otherProduct.body':
    'This product is not the one open, so Pinto cannot show its current prices here. Every country goes back to its previous price, including any edited since.',
  'history.restore.otherProduct.open': 'Open this product to compare',

  'history.clear.action': 'Clear history',
  'history.clear.title': 'Clear the whole history?',
  'history.clear.body': {
    one: 'The only operation and its restore point will be deleted permanently. You will no longer be able to put back the prices it changed.',
    other: 'All {count} operations and their restore points will be deleted permanently. You will no longer be able to put back the prices they changed.',
  },
  'history.clear.confirm': 'Clear history',
  'history.cleared': 'History cleared',
} as const;
