import { parseCorsOrigins, buildCorsOrigin } from './cors-origins';

describe('parseCorsOrigins', () => {
  it('returns empty for unset, blank, or whitespace', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('  ,  ')).toEqual([]);
  });

  it('splits on comma and strips slashes', () => {
    expect(
      parseCorsOrigins('https://app.sportbooker.net/, http://localhost:5173'),
    ).toEqual(['https://app.sportbooker.net', 'http://localhost:5173']);
  });
});

describe('buildCorsOrigin', () => {
  const appDomain = 'sportbooker.net';

  function checkOrigin(
    originFn: ReturnType<typeof buildCorsOrigin>,
    origin: string | undefined,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!originFn) return resolve(false);
      originFn(origin, (_err, allow) => resolve(!!allow));
    });
  }

  it('returns false when no static origins and no appDomain', () => {
    expect(buildCorsOrigin([], '')).toBe(false);
  });

  it('allows static origins', async () => {
    const fn = buildCorsOrigin(['http://localhost:5173'], appDomain);
    expect(await checkOrigin(fn, 'http://localhost:5173')).toBe(true);
    expect(await checkOrigin(fn, 'http://localhost:9999')).toBe(false);
  });

  it('allows any https subdomain of appDomain', async () => {
    const fn = buildCorsOrigin([], appDomain);
    expect(await checkOrigin(fn, 'https://acfc.sportbooker.net')).toBe(true);
    expect(await checkOrigin(fn, 'https://app.sportbooker.net')).toBe(true);
    expect(await checkOrigin(fn, 'https://deep.sub.sportbooker.net')).toBe(
      true,
    );
  });

  it('rejects non-https subdomain requests', async () => {
    const fn = buildCorsOrigin([], appDomain);
    expect(await checkOrigin(fn, 'http://acfc.sportbooker.net')).toBe(false);
  });

  it('rejects origins that look similar but are not subdomains', async () => {
    const fn = buildCorsOrigin([], appDomain);
    expect(await checkOrigin(fn, 'https://evil-sportbooker.net')).toBe(false);
    expect(await checkOrigin(fn, 'https://sportbooker.net.evil.com')).toBe(
      false,
    );
  });

  it('allows requests with no origin (server-to-server)', async () => {
    const fn = buildCorsOrigin(['http://localhost:5173'], appDomain);
    expect(await checkOrigin(fn, undefined)).toBe(true);
  });
});
