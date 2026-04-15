import { parseE164ToBigint } from './register-phone.util';

describe('parseE164ToBigint', () => {
  it('strips + and returns bigint digits', () => {
    expect(parseE164ToBigint('+963998163901')).toBe(963998163901n);
  });

  it('supports UAE-style numbers', () => {
    expect(parseE164ToBigint('+971501234567')).toBe(971501234567n);
  });

  it('supports US +1', () => {
    expect(parseE164ToBigint('+12345678901')).toBe(12345678901n);
  });
});
