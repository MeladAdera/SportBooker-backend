/**
 * E.164: optional leading `+`, max 15 digits total (ITU-T E.164).
 * API accepts and returns strings like `+963998163901`; DB stores digits only as BIGINT.
 */
export const E164_STRING_REGEX = /^\+[1-9]\d{1,14}$/;

/** Parses validated E.164 (must match {@link E164_STRING_REGEX}) to full digits as BIGINT. */
export function parseE164ToBigint(e164: string): bigint {
  return BigInt(e164.slice(1));
}
