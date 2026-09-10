import { expect, test } from '@playwright/test';
import { pageSchema } from '../../src/config/schema.js';
import { loadPageRegistry } from '../../src/config/loaders.js';
import { resolve } from 'node:path';
test.describe('configuration validation', () => {
  test('reports the invalid field', () => {
    const parsed = pageSchema.safeParse({
      id: 'x',
      urls: { template: 'invalid', ote: 'invalid', production: 'invalid' },
      severity: 'medium',
      status: 'confirmed',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].path).toContain('urls');
  });
  test('defaults the three environment roles to reference and targets', () => {
    const parsed = pageSchema.parse({
      id: 'x',
      urls: {
        template: 'https://example.com/template',
        ote: 'https://example.com/ote',
        production: 'https://example.com/production',
      },
      severity: 'medium',
      status: 'confirmed',
    });
    expect(parsed.roles).toEqual({ template: 'reference', ote: 'target', production: 'target' });
  });
  test('loads a same-page-type fixture from configuration without framework changes', async () => {
    const pages = await loadPageRegistry(resolve('config/pages'));
    expect(pages.map((page) => page.id)).toEqual(
      expect.arrayContaining(['fixture-page', 'hosting', 'cloud-server']),
    );
    expect(pages.find((page) => page.id === 'fixture-page')?.pageType).toBe('service-category');
  });
});
