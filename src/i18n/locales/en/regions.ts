/**
 * Continents, sub-regions and the purchasing-power bands. Country names are
 * not here: `Intl.DisplayNames` already knows every one of them in every
 * language, and a hand-kept list would only drift.
 */
export const regions = {
  'continent.Africa': 'Africa',
  'continent.Asia': 'Asia',
  'continent.Europe': 'Europe',
  'continent.North America': 'North America',
  'continent.South America': 'South America',
  'continent.Oceania': 'Oceania',
  'continent.Other': 'Other',

  'subregion.Australasia': 'Australasia',
  'subregion.Caribbean': 'Caribbean',
  'subregion.Central Africa': 'Central Africa',
  'subregion.Central America': 'Central America',
  'subregion.Central Asia': 'Central Asia',
  'subregion.East Africa': 'East Africa',
  'subregion.East Asia': 'East Asia',
  'subregion.Eastern Europe': 'Eastern Europe',
  'subregion.North Africa': 'North Africa',
  'subregion.Northern America': 'Northern America',
  'subregion.Northern Europe': 'Northern Europe',
  'subregion.Pacific Islands': 'Pacific Islands',
  'subregion.South America': 'South America',
  'subregion.South Asia': 'South Asia',
  'subregion.Southeast Asia': 'Southeast Asia',
  'subregion.Southern Africa': 'Southern Africa',
  'subregion.Southern Europe': 'Southern Europe',
  'subregion.West Africa': 'West Africa',
  'subregion.Western Asia': 'Western Asia',
  'subregion.Western Europe': 'Western Europe',
  'subregion.Unknown': 'Unknown',

  'band.T1.label': 'T1 · Premium',
  'band.T1.blurb': 'High income, high app spend',
  'band.T2.label': 'T2 · Established',
  'band.T2.blurb': 'High income, softer app spend',
  'band.T3.label': 'T3 · Upper-middle',
  'band.T3.blurb': 'Upper-middle income',
  'band.T4.label': 'T4 · Lower-middle',
  'band.T4.blurb': 'Lower-middle income',
  'band.T5.label': 'T5 · Volume',
  'band.T5.blurb': 'Low income, price-sensitive, high volume',
  'band.basis':
    'Based on World Bank income groups and GNI per capita at purchasing power parity, adjusted for observed app-store spend. A starting point to edit, not a measurement.',

  'curve.flat.label': 'Flat',
  'curve.flat.blurb': 'The same price everywhere — open the gaps yourself.',
  'curve.gentle.label': 'Gentle',
  'curve.gentle.blurb': 'Small discounts. Protects revenue per sale.',
  'curve.balanced.label': 'Balanced',
  'curve.balanced.blurb': 'Moderate discounts. A good default for one-time purchases.',
  'curve.aggressive.label': 'Aggressive',
  'curve.aggressive.blurb': 'Deep discounts. Favours volume in emerging markets.',
} as const;
