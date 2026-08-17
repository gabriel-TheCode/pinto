import type { Currency, CurrencyCode } from '@/types';

/**
 * Currencies Google Play can bill in, with their ISO 4217 minor-unit count.
 * The decimals matter: a price is only valid if it is a whole number of minor
 * units, so JPY 4.99 and KWD 4.995 are both invalid and Pinto must say so
 * before the API does.
 */
const TABLE: ReadonlyArray<readonly [CurrencyCode, number, string]> = [
  ['AED', 2, 'د.إ'], ['ALL', 2, 'L'], ['AMD', 2, '֏'], ['AOA', 2, 'Kz'],
  ['ARS', 2, '$'], ['AUD', 2, 'A$'], ['AZN', 2, '₼'], ['BAM', 2, 'KM'],
  ['BDT', 2, '৳'], ['BGN', 2, 'лв'], ['BHD', 3, '.د.ب'], ['BOB', 2, 'Bs'],
  ['BRL', 2, 'R$'], ['BYN', 2, 'Br'], ['CAD', 2, 'C$'], ['CHF', 2, 'CHF'],
  ['CLP', 0, '$'], ['CNY', 2, '¥'], ['COP', 2, '$'], ['CRC', 2, '₡'],
  ['CZK', 2, 'Kč'], ['DKK', 2, 'kr'], ['DZD', 2, 'د.ج'], ['EGP', 2, 'E£'],
  ['EUR', 2, '€'], ['GBP', 2, '£'], ['GEL', 2, '₾'], ['GHS', 2, '₵'],
  ['HKD', 2, 'HK$'], ['HNL', 2, 'L'], ['HRK', 2, 'kn'], ['HUF', 2, 'Ft'],
  ['IDR', 2, 'Rp'], ['ILS', 2, '₪'], ['INR', 2, '₹'], ['IQD', 3, 'ع.د'],
  ['ISK', 0, 'kr'], ['JOD', 3, 'د.ا'], ['JPY', 0, '¥'], ['KES', 2, 'KSh'],
  ['KGS', 2, 'с'], ['KRW', 0, '₩'], ['KWD', 3, 'د.ك'], ['KZT', 2, '₸'],
  ['LBP', 2, 'ل.ل'], ['LKR', 2, 'Rs'], ['MAD', 2, 'د.م.'], ['MDL', 2, 'L'],
  ['MKD', 2, 'ден'], ['MMK', 2, 'K'], ['MXN', 2, '$'], ['MYR', 2, 'RM'],
  ['MZN', 2, 'MT'], ['NGN', 2, '₦'], ['NIO', 2, 'C$'], ['NOK', 2, 'kr'],
  ['NPR', 2, 'Rs'], ['NZD', 2, 'NZ$'], ['OMR', 3, 'ر.ع.'], ['PAB', 2, 'B/.'],
  ['PEN', 2, 'S/'], ['PHP', 2, '₱'], ['PKR', 2, 'Rs'], ['PLN', 2, 'zł'],
  ['PYG', 0, '₲'], ['QAR', 2, 'ر.ق'], ['RON', 2, 'lei'], ['RSD', 2, 'дин'],
  ['RUB', 2, '₽'], ['RWF', 0, 'FRw'], ['SAR', 2, 'ر.س'], ['SEK', 2, 'kr'],
  ['SGD', 2, 'S$'], ['THB', 2, '฿'], ['TND', 3, 'د.ت'], ['TRY', 2, '₺'],
  ['TWD', 2, 'NT$'], ['TZS', 2, 'TSh'], ['UAH', 2, '₴'], ['UGX', 0, 'USh'],
  ['USD', 2, '$'], ['UYU', 2, '$U'], ['UZS', 2, "so'm"], ['VES', 2, 'Bs.'],
  ['VND', 0, '₫'], ['XAF', 0, 'FCFA'], ['XOF', 0, 'CFA'], ['ZAR', 2, 'R'],
  ['ZMW', 2, 'ZK'],
];

export const CURRENCIES: Record<CurrencyCode, Currency> = Object.fromEntries(
  TABLE.map(([code, decimals, symbol]) => [code, { code, decimals, symbol }]),
);

const DEFAULT_CURRENCY: Currency = { code: 'USD', decimals: 2, symbol: '$' };

/**
 * Never throws: an unknown currency degrades to 2 decimals rather than
 * blocking the user. Callers that need certainty use `isKnownCurrency`.
 */
export function getCurrency(code: CurrencyCode): Currency {
  return CURRENCIES[code] ?? { code, decimals: 2, symbol: code };
}

export function isKnownCurrency(code: CurrencyCode): boolean {
  return code in CURRENCIES;
}

export { DEFAULT_CURRENCY };
