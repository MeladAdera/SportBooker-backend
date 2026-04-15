import { phoneE164FromDb } from './phone-from-db';

describe('phoneE164FromDb', () => {
  it('formats bigint digits as E.164', () => {
    expect(phoneE164FromDb(963998163901n)).toBe('+963998163901');
  });

  it('formats finite number', () => {
    expect(phoneE164FromDb(97150001000)).toBe('+97150001000');
  });

  it('accepts pg string bigint', () => {
    expect(phoneE164FromDb('97150001000')).toBe('+97150001000');
  });

  it('returns undefined for null, zero, empty', () => {
    expect(phoneE164FromDb(null)).toBeUndefined();
    expect(phoneE164FromDb(0)).toBeUndefined();
    expect(phoneE164FromDb(0n)).toBeUndefined();
    expect(phoneE164FromDb('')).toBeUndefined();
  });
});
