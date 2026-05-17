import { BadRequestException } from '@nestjs/common';
import { VenueSportType } from './venue-sport-type';

const ALLOWED = new Set<string>(Object.values(VenueSportType));

/**
 * Parses multipart/form field `sportTypes` (JSON array string) into enum values.
 */
export function parseSportTypesJson(raw: string): VenueSportType[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('sportTypes must be valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length < 1) {
    throw new BadRequestException('sportTypes must be a non-empty JSON array');
  }
  for (const item of parsed) {
    if (typeof item !== 'string' || !ALLOWED.has(item)) {
      throw new BadRequestException(
        `Invalid sport type: ${String(item)}. Allowed: football, padel, cricket, generic`,
      );
    }
  }
  return parsed as VenueSportType[];
}
