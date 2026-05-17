import { BadRequestException } from '@nestjs/common';
import { VenueSportType } from './venue-sport-type';
import { parseSportTypesJson } from './parse-sport-types-json';

describe('parseSportTypesJson', () => {
  it('parses valid JSON array', () => {
    expect(parseSportTypesJson('["football","basketball"]')).toEqual([
      VenueSportType.Football,
      VenueSportType.Basketball,
    ]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSportTypesJson('not-json')).toThrow(BadRequestException);
  });

  it('throws on empty array', () => {
    expect(() => parseSportTypesJson('[]')).toThrow(BadRequestException);
  });

  it('throws on invalid enum value', () => {
    expect(() => parseSportTypesJson('["football","cricket"]')).toThrow(
      BadRequestException,
    );
  });
});
