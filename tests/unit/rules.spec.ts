import { expect, test } from '@playwright/test';
import { evaluateRules } from '../../src/rules/engine/engine.js';
import type { PageRegistryEntry, ScanResult } from '../../src/domain/models.js';
const page: PageRegistryEntry = {
  id: 'p1',
  urls: {
    template: 'https://fixture.invalid/',
    ote: 'https://fixture.invalid/',
    production: 'https://fixture.invalid/',
  },
  roles: { template: 'reference', ote: 'target', production: 'target' },
  severity: 'medium',
  status: 'confirmed',
};
const scan: ScanResult = {
  pageId: 'p1',
  environment: 'ote',
  role: 'target',
  requestedUrl: page.urls.ote,
  httpStatus: 200,
  redirectChain: [],
  startedAt: '',
  finishedAt: '',
  durationMs: 1,
  consoleMessages: [],
  pageErrors: [],
  network: [],
  linkChecks: [],
  safety: { blockedNonReadRequests: 0, completedNonReadRequests: 0 },
  dom: { rendered: true, bodyTextLength: 1, horizontalOverflow: true },
  model: { sections: [], visibleText: '', links: [], internalLinks: [], observations: {} },
  viewport: { width: 1, height: 1 },
  browser: { name: 'chromium', version: 'x' },
};
test.describe('rule engine', () => {
  test('does not evaluate Template reference console, resource, or link errors', () => {
    const reference = {
      ...scan,
      environment: 'template' as const,
      role: 'reference' as const,
      consoleMessages: [{ type: 'error', text: 'template error' }],
      pageErrors: ['template page error'],
      linkChecks: [
        {
          rawHref: '/en',
          resolvedUrl: 'https://fixture.invalid/en',
          attempts: [],
          outcome: 'FAIL' as const,
        },
      ],
      network: [
        {
          url: 'https://fixture.invalid/a.js',
          method: 'GET',
          resourceType: 'script',
          failure: 'failed',
        },
      ],
    };
    expect(
      evaluateRules(page, reference, [
        {
          id: 'critical-console',
          tier: 'global',
          target: '*',
          definition: { thirdPartyIgnorePatterns: [] },
          severity: 'high',
          enabled: true,
          version: 1,
        },
      ]),
    ).toEqual([]);
  });
  test('does not turn the scanner read-only abort message into a console failure', () => {
    const result = evaluateRules(
      page,
      { ...scan, consoleMessages: [{ type: 'error', text: 'net::ERR_BLOCKED_BY_CLIENT' }] },
      [
        {
          id: 'critical-console',
          tier: 'global',
          target: '*',
          definition: { thirdPartyIgnorePatterns: [] },
          severity: 'high',
          enabled: true,
          version: 1,
        },
      ],
    )[0];
    expect(result.verdict).toBe('PASS');
  });
  test('returns CONFIG_MISSING for layout selectors not supplied', () =>
    expect(
      evaluateRules(page, scan, [
        {
          id: 'layout-frame',
          tier: 'global',
          target: '*',
          definition: {},
          severity: 'high',
          enabled: true,
          version: 1,
        },
      ])[0].verdict,
    ).toBe('CONFIG_MISSING'));
  test('does not silently pass layout without collected selector observations', () =>
    expect(
      evaluateRules(page, scan, [
        {
          id: 'layout-frame',
          tier: 'global',
          target: '*',
          definition: {},
          severity: 'high',
          enabled: true,
          version: 1,
        },
      ])[0].verdict,
    ).toBe('CONFIG_MISSING'));
  test('does not run page type rules for pending classification', () =>
    expect(
      evaluateRules({ ...page, status: 'pending_classification' }, scan, [
        {
          id: 'x',
          tier: 'page_type',
          target: 'news',
          definition: {},
          severity: 'medium',
          enabled: true,
          version: 1,
        },
      ])[0].verdict,
    ).toBe('DISABLED'));
  test('does not activate exception behavior', () =>
    expect(
      evaluateRules(page, scan, [
        {
          id: 'x',
          tier: 'exception',
          target: '*',
          definition: {},
          severity: 'medium',
          enabled: true,
          version: 1,
        },
      ])[0].verdict,
    ).toBe('CONFIG_PENDING'));
});
