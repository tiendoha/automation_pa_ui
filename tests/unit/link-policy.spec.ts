import { expect, test } from '@playwright/test';
import {
  canonicalRouteKey,
  canonicalTrailingSlashUrl,
  checkInternalLink,
} from '../../src/normalization/link-policy.js';

const origin = 'https://www.pavietnam.vn';
const sequence = (...responses: Array<{ status?: number; error?: string }>) => {
  const calls: Array<{ url: string; method: string }> = [];
  return {
    calls,
    prober: async (url: string, method: 'HEAD' | 'GET') => {
      calls.push({ url, method });
      return responses.shift() ?? {};
    },
  };
};

test.describe('generic internal-link trailing slash policy', () => {
  test('canonicalizes only eligible internal webpage routes and preserves query/fragment', () => {
    expect(canonicalTrailingSlashUrl(`${origin}/vn/tong-dai?source=menu#top`, [origin])).toBe(
      `${origin}/vn/tong-dai/?source=menu#top`,
    );
    expect(canonicalTrailingSlashUrl(`${origin}/vn/hosting/`, [origin])).toBeUndefined();
    expect(canonicalTrailingSlashUrl(`${origin}/`, [origin])).toBeUndefined();
    expect(canonicalTrailingSlashUrl(`${origin}/assets/app.js`, [origin])).toBeUndefined();
    expect(canonicalTrailingSlashUrl('https://external.invalid/path', [origin])).toBeUndefined();
  });

  test('never probes an unsafe route', async () => {
    const probe = sequence({ status: 200 });
    const result = await checkInternalLink({
      rawHref: '/logout',
      resolvedUrl: `${origin}/logout`,
      configuredOrigins: [origin],
      prober: probe.prober,
    });
    expect(result.outcome).toBe('UNSAFE_SKIPPED');
    expect(probe.calls).toEqual([]);
  });

  test('records GET fallback after a failed raw HEAD', async () => {
    const probe = sequence({ status: 405 }, { status: 200 });
    const result = await checkInternalLink({
      rawHref: '/x',
      resolvedUrl: `${origin}/x`,
      configuredOrigins: [origin],
      prober: probe.prober,
    });
    expect(result.outcome).toBe('PASS_GET_FALLBACK');
    expect(result.attempts.map((item) => item.method)).toEqual(['HEAD', 'GET']);
  });

  test('records raw and canonical evidence when only the canonical route works', async () => {
    const probe = sequence({ status: 404 }, { status: 404 }, { status: 200 });
    const result = await checkInternalLink({
      rawHref: '/vn/x',
      resolvedUrl: `${origin}/vn/x`,
      configuredOrigins: [origin],
      prober: probe.prober,
    });
    expect(result).toMatchObject({
      canonicalUrl: `${origin}/vn/x/`,
      outcome: 'PASS_CANONICALIZED',
      warning: 'RAW_URL_404_CANONICAL_OK',
    });
    expect(result.attempts).toHaveLength(3);
  });

  test('fails only after both raw and canonical probes fail', async () => {
    const probe = sequence({ status: 404 }, { status: 404 }, { status: 404 }, { status: 404 });
    const result = await checkInternalLink({
      rawHref: '/vn/x',
      resolvedUrl: `${origin}/vn/x`,
      configuredOrigins: [origin],
      prober: probe.prober,
    });
    expect(result.outcome).toBe('FAIL');
    expect(result.attempts).toHaveLength(4);
  });

  test('treats status 0 as inconclusive environment evidence, not a website failure', async () => {
    const probe = sequence({ status: 0 }, { status: 0 });
    const result = await checkInternalLink({
      rawHref: '/x',
      resolvedUrl: `${origin}/x`,
      configuredOrigins: [origin],
      prober: probe.prober,
    });
    expect(result.outcome).toBe('INCONCLUSIVE');
    expect(result.reason).toContain('ENVIRONMENT_ERROR');
  });

  test('deduplicates slash variants across OTE and Production logical origins while retaining raw values', () => {
    expect(
      canonicalRouteKey(`${origin}/vn/hosting`, [origin, 'https://www-ote.pavietnam.vn']),
    ).toBe('/vn/hosting/');
    expect(
      canonicalRouteKey('https://www-ote.pavietnam.vn/vn/hosting/', [
        origin,
        'https://www-ote.pavietnam.vn',
      ]),
    ).toBe('/vn/hosting/');
  });
});
