/**
 * What a row in the price table can say about itself, keyed by
 * `ChangeIssue.code`, plus the formula parser's errors keyed by their code.
 */
export const issues = {
  'issue.no-current-price': 'No current price here, so there is nothing to adjust.',
  'issue.no-source-price': 'The country to copy from has no price.',
  'issue.no-base-price': 'The reference country has no price, and no anchor price is set.',
  'issue.no-rates': 'No exchange rates are available to convert this price.',
  'issue.no-rate': 'No exchange rate for {currency} — the product has no {currency} price yet.',
  'issue.tier-undefined': 'Tier “{tier}” has no percentage.',
  'issue.formula-error': 'The formula failed: {reason}',
  'issue.not-positive': 'The price must be above zero.',
  'issue.granularity-whole': '{currency} has no cents — the price must be a whole number.',
  'issue.granularity-minor': {
    one: '{currency} prices have {decimals} decimal place.',
    other: '{currency} prices have {decimals} decimal places.',
  },
  'issue.unknown-currency':
    'Pinto has no decimal rule for {currency} and assumed two. Check this price.',
  'issue.large-increase': 'Rises by more than {threshold}.',
  'issue.large-decrease': 'Falls by more than {threshold}.',
  'issue.rounded': 'Adjusted by the rounding rule.',
  'issue.below-floor': 'Raised to your minimum price.',
  'issue.above-ceiling': 'Lowered to your maximum price.',
  'issue.override': 'Set to this country’s own price.',
  'issue.untiered': 'Not in any tier, so its price stays as it is.',
  'issue.not-sold': 'This product is not sold here. Add the country in Play Console first.',
  'issue.clamped-increase': 'Held to your maximum increase of {limit}.',
  'issue.clamped-decrease': 'Held to your maximum decrease of {limit}.',

  'formula.empty': 'the formula is empty',
  'formula.not-a-number': '“{text}” is not a number',
  'formula.unexpected-character': 'unexpected character “{char}”',
  'formula.expected': '“{token}” is missing',
  'formula.trailing-input': 'there is something extra at the end',
  'formula.unknown-function': 'unknown function “{name}”',
  'formula.arity': '“{name}” takes {min} to {max} values',
  'formula.unknown-name': 'unknown name “{name}” — use current or base',
  'formula.unexpected-end': 'the formula ends too early',
  'formula.division-by-zero': 'division by zero',
  'formula.unsupported-operator': 'unsupported operator “{op}”',
  'formula.not-finite': 'the result is not a number',
  'formula.invalid': 'the formula is not valid',
} as const;
