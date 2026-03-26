/**
 * IANA timezone identifiers supported by the runtime (via Intl).
 * Used to validate tenant timezone strings without a static list dependency.
 */
const intlWithTimeZones = Intl as typeof Intl & {
  supportedValuesOf(key: 'timeZone'): string[];
};

const IANA_TIMEZONE_SET = new Set(
  intlWithTimeZones.supportedValuesOf('timeZone'),
);

export function isValidIanaTimeZone(value: string): boolean {
  return IANA_TIMEZONE_SET.has(value);
}
