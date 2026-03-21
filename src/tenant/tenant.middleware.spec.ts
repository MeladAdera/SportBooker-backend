import { extractSubdomain } from './tenant.middleware';

describe('extractSubdomain', () => {
  it('extracts subdomain from acfc.sportbooker.com', () => {
    expect(extractSubdomain('acfc.sportbooker.com', 'sportbooker.com')).toBe(
      'acfc',
    );
  });

  it('extracts subdomain from acfc.localhost:3000', () => {
    expect(extractSubdomain('acfc.localhost:3000', 'localhost:3000')).toBe(
      'acfc',
    );
  });

  it('returns null for sportbooker.com (no subdomain)', () => {
    expect(extractSubdomain('sportbooker.com', 'sportbooker.com')).toBeNull();
  });

  it('returns null for localhost:3000 (no subdomain)', () => {
    expect(extractSubdomain('localhost:3000', 'localhost:3000')).toBeNull();
  });

  it('returns null for evil-sportbooker.com (prefix does not end with dot)', () => {
    expect(
      extractSubdomain('evil-sportbooker.com', 'sportbooker.com'),
    ).toBeNull();
  });

  it('returns null for empty host', () => {
    expect(extractSubdomain('', 'sportbooker.com')).toBeNull();
  });

  it('returns null for empty appDomain', () => {
    expect(extractSubdomain('acfc.sportbooker.com', '')).toBeNull();
  });

  it('returns null when host does not end with appDomain', () => {
    expect(extractSubdomain('acfc.example.com', 'sportbooker.com')).toBeNull();
  });

  it('handles case insensitivity', () => {
    expect(extractSubdomain('ACFC.SportBooker.com', 'sportbooker.com')).toBe(
      'acfc',
    );
  });
});
