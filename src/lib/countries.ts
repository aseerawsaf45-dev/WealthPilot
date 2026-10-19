/** ISO-3166 alpha-2 countries (World Bank covers nearly all of them). Names come from Intl at runtime. */
export const COUNTRY_CODES = (
  'AE AF AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT ' +
  'JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LK LR LS LT LU LV LY MA MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA ' +
  'NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ ' +
  'TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VC VE VN VU WS XK YE ZA ZM ZW'
).split(' ');

const CODE_SET = new Set(COUNTRY_CODES);
export const isCountryCode = (c: unknown): c is string => typeof c === 'string' && CODE_SET.has(c);

let names: Intl.DisplayNames | null = null;
export function countryName(code: string, locale = 'en'): string {
  try {
    names ??= new Intl.DisplayNames([locale], { type: 'region' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Options sorted by name, for selects. */
export function countryOptions(): Array<{ code: string; name: string }> {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
}
