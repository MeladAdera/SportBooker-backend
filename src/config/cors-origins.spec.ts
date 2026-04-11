import { parseCorsOrigins } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('returns empty for unset, blank, or whitespace', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('  ,  ')).toEqual([]);
  });

  it('splits on comma and strips slashes', () => {
    expect(
      parseCorsOrigins(
        'https://sport-booker-fe.vercel.app/, http://localhost:5173',
      ),
    ).toEqual(['https://sport-booker-fe.vercel.app', 'http://localhost:5173']);
  });
});
