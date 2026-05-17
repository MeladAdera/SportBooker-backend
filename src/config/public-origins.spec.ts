import { ConfigService } from '@nestjs/config';
import {
  resolveApiPublicOrigin,
  resolveWebAppPublicOrigin,
} from './public-origins';

function makeConfig(values: Record<string, string | number>): ConfigService {
  return {
    get: <T = string | number>(key: string): T | undefined =>
      values[key] as T | undefined,
  } as ConfigService;
}

describe('resolveApiPublicOrigin', () => {
  it('uses API_PUBLIC_ORIGIN when set', () => {
    expect(
      resolveApiPublicOrigin(
        makeConfig({
          API_PUBLIC_ORIGIN: 'https://api.example.com/',
          PORT: 3000,
        }),
      ),
    ).toBe('https://api.example.com');
  });

  it('defaults to localhost with PORT', () => {
    expect(resolveApiPublicOrigin(makeConfig({ PORT: 3000 }))).toBe(
      'http://localhost:3000',
    );
  });
});

describe('resolveWebAppPublicOrigin', () => {
  it('prefers WEB_APP_PUBLIC_ORIGIN', () => {
    expect(
      resolveWebAppPublicOrigin(
        makeConfig({
          WEB_APP_PUBLIC_ORIGIN: 'https://app.example.com',
          API_PUBLIC_ORIGIN: 'https://api.example.com',
          PORT: 3000,
        }),
      ),
    ).toBe('https://app.example.com');
  });

  it('falls back to API origin', () => {
    expect(
      resolveWebAppPublicOrigin(
        makeConfig({ API_PUBLIC_ORIGIN: 'https://api.x.net', PORT: 3000 }),
      ),
    ).toBe('https://api.x.net');
  });
});
