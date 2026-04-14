import { buildTenantPublicOrigin } from './tenant-public-url';

describe('buildTenantPublicOrigin', () => {
  it('builds acfc.localhost with port from TENANT_HOST_SUFFIX', () => {
    expect(
      buildTenantPublicOrigin(
        'http://localhost:3000',
        'localhost:3000',
        'acfc',
      ),
    ).toBe('http://acfc.localhost:3000');
  });

  it('uses https from web app origin string', () => {
    expect(
      buildTenantPublicOrigin(
        'https://sportbooker.com',
        'sportbooker.com',
        'Downtown',
      ),
    ).toBe('https://downtown.sportbooker.com');
  });

  it('strips trailing slash on origin string', () => {
    expect(
      buildTenantPublicOrigin(
        'http://localhost:3000/',
        'localhost:3000',
        'acfc',
      ),
    ).toBe('http://acfc.localhost:3000');
  });
});
