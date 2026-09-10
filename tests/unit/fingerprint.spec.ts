import { expect, test } from '@playwright/test';
import {
  createFingerprint,
  normalizeError,
  normalizeUrl,
} from '../../src/fingerprint/fingerprint.js';
test.describe('fingerprint', () => {
  test('only removes configured query parameters and makes a stable hash', () => {
    const url = normalizeUrl('https://fixture.invalid/path?keep=1&trace=2', ['trace']);
    expect(url).toContain('keep=1');
    expect(url).not.toContain('trace=');
    const input = {
      environment: 'ote' as const,
      normalizedUrl: url,
      ruleId: 'layout-frame',
      componentOrApiId: 'main',
      normalizedError: 'id=[DYNAMIC]',
    };
    expect(createFingerprint(input).hash).toBe(createFingerprint(input).hash);
  });
  test('masks only configured dynamic fields', () =>
    expect(normalizeError('id=123 timestamp=99', [/id=\d+/g])).toBe('[DYNAMIC] timestamp=99'));
});
