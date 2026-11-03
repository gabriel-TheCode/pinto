/** The frame around the job: header, product bar, the three steps, the footer. */
export const workspace = {
  'workspace.header.history': 'History',
  'workspace.header.help': 'Help',
  'workspace.header.settings': 'Settings',
  'workspace.header.packageLabel': 'App',
  'workspace.loading': 'Loading Pinto…',

  'workspace.product.label': 'Product',
  'workspace.product.choose': 'Choose a product…',
  'workspace.product.priced': {
    one: 'Priced in {count} country',
    other: 'Priced in {count} countries',
  },
  'workspace.product.unavailableGroupTitle': {
    one: '{count} product type could not be listed',
    other: '{count} product types could not be listed',
  },
  'workspace.product.unavailableItem': '{group}: {reason}',
  'workspace.product.unavailableNote':
    'These products are missing from the list, which does not mean there are none.',
  'workspace.product.noOneTime':
    'This app has no one-time products. A lifetime purchase is a one-time product: create it in Play Console under Monetise with Play → Products, then reload.',

  'workspace.loadingProducts': 'Loading products…',
  'workspace.loadingPrices': 'Loading prices…',
  'workspace.noProducts.title': 'No products to price yet',
  'workspace.noProducts.body':
    'This app has no subscriptions or one-time products. Create one in Play Console, then reload.',
  'workspace.listFailed.title': 'Products could not be loaded',
  'workspace.chooseProduct.title': 'Choose a product to price',
  'workspace.chooseProduct.body':
    'Pick a subscription base plan or a one-time product above. Opening a product in Play Console selects it here automatically.',

  'workspace.package.detectedTitle': 'Detected app: {package}',
  'workspace.package.detectedBody':
    'Pinto read this package name from the page. Check it is the right app before changing any price.',
  'workspace.package.confirm': 'That’s right',
  'workspace.package.change': 'Change',

  'workspace.steps.label': 'Price change steps',
  'workspace.step.strategy': 'Change',
  'workspace.step.markets': 'Countries',
  'workspace.step.review': 'Review',
  'workspace.step.position': 'Step {current} of {total}',
  'workspace.step.strategy.empty': 'Not chosen',
  'workspace.step.markets.summary': '{selected} of {total}',
  'workspace.step.review.summary': { one: '{count} change', other: '{count} changes' },
  'workspace.step.review.empty': 'Nothing yet',

  'workspace.summary.none': 'No price changes yet',
  'workspace.summary.changes': {
    one: '{count} price will change',
    other: '{count} prices will change',
  },
  'workspace.summary.blocked': { one: '{count} blocked', other: '{count} blocked' },
  'workspace.summary.warnings': { one: '{count} to check', other: '{count} to check' },
  'workspace.summary.selected': {
    one: '{count} country selected',
    other: '{count} countries selected',
  },
  'workspace.next.markets': 'Choose countries',
  'workspace.next.review': 'Review changes',
} as const;
