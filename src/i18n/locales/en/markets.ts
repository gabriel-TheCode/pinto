/** Step 2, "Countries": where the change applies. */
export const markets = {
  'markets.title': 'Which countries?',
  'markets.subtitle': 'Prices change only in the selected countries.',

  'markets.search.label': 'Search countries',
  'markets.search.placeholder': 'Country, code or currency',

  'markets.filters.toggle': 'Filters',
  'markets.filters.active': { one: '{count} active', other: '{count} active' },
  'markets.filters.continents': 'Continent',
  'markets.filters.subregions': 'Region',
  'markets.filters.currency': 'Currency',
  'markets.filters.allCurrencies': 'All currencies',
  'markets.filters.reset': 'Reset filters',

  'markets.selection.allShown': 'Select all shown',
  'markets.selection.selected': { one: '{count} selected', other: '{count} selected' },
  'markets.selection.shown': { one: '{count} shown', other: '{count} shown' },
  'markets.selection.all': 'Select all',
  'markets.selection.none': 'Select none',
  'markets.selection.hidden': {
    one: '{count} selected country is hidden by your filters. Its price will change too.',
    other: '{count} selected countries are hidden by your filters. Their prices will change too.',
  },
  'markets.selection.keepShown': 'Keep only shown countries',
  'markets.selection.showHidden': 'Show them',

  'markets.groups.label': 'Your groups',
  'markets.groups.hint':
    'Click a group to select only its countries. <kbd>Shift</kbd>-click to add them to the selection.',
  'markets.groups.save': 'Save selection as group',
  'markets.groups.saveBody': {
    one: 'Name this selection to pick the same country again in one click, on any product.',
    other: 'Name this selection to pick the same {count} countries again in one click, on any product.',
  },
  'markets.groups.name': 'Group name',
  'markets.groups.namePlaceholder': 'e.g. Nordics',
  'markets.groups.delete': 'Delete group “{name}”',
  'markets.groups.deleteTitle': 'Delete group “{name}”?',
  'markets.groups.deleteBody':
    'The group is removed for every product. Your current selection stays as it is.',
  'markets.groups.saved': { one: 'Group “{name}” saved — {count} country', other: 'Group “{name}” saved — {count} countries' },

  'markets.table.label': 'Countries',
  'markets.table.country': 'Country',
  'markets.table.price': 'Price',
  'markets.row.change': 'from {from} to {to}',
  'markets.row.noChange': 'No change',
  'markets.row.blocked': 'Blocked',


  'markets.empty.title': 'No countries match',
  'markets.empty.body': 'Try another search, or reset the filters.',
} as const;
