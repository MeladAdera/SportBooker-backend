/** BIGINT digits from DB → E.164 string for API (`+` + digits). `0`/absent → `undefined`. */
export function phoneE164FromDb(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  let digits: string;
  if (typeof value === 'bigint') {
    if (value === 0n) {
      return undefined;
    }
    digits = value.toString();
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value) || value === 0) {
      return undefined;
    }
    digits = String(Math.trunc(value));
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (raw === '' || raw === '0') {
      return undefined;
    }
    digits = raw.replace(/\D/g, '');
  } else {
    return undefined;
  }
  if (digits === '' || /^0+$/.test(digits)) {
    return undefined;
  }
  return `+${digits}`;
}
