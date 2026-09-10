import { expect, test } from '@playwright/test';
import { linkDiff, sectionOrderDiff } from '../../src/normalization/comparator.js';
import { normalizeUrl, normalizeWhitespace } from '../../src/normalization/model.js';

test.describe('normalization and comparison', () => {
  test('normalizes whitespace and URL fragments consistently', () => {
    expect(normalizeWhitespace(' A\n  B\t C ')).toBe('A B C');
    expect(normalizeUrl('/vn/x?b=2&a=1#heading', 'https://www.pavietnam.vn/')).toBe(
      'https://www.pavietnam.vn/vn/x?a=1&b=2#heading',
    );
  });
  test('reports section order and link differences with detail', () => {
    const model = (keys: string[]) => ({
      sections: keys.map((key) => ({ key, text: key })),
      visibleText: '',
      links: [],
      internalLinks: [],
      observations: {},
    });
    expect(sectionOrderDiff(model(['banner', 'price']), model(['price', 'banner']))).toMatchObject({
      matches: false,
      expected: ['banner', 'price'],
      actual: ['price', 'banner'],
    });
    expect(
      linkDiff(
        [{ text: 'A', href: 'https://x/a', internal: true }],
        [{ text: 'B', href: 'https://x/b', internal: true }],
      ),
    ).toEqual({
      missing: [{ text: 'A', href: 'https://x/a', internal: true }],
      unexpected: [{ text: 'B', href: 'https://x/b', internal: true }],
    });
  });
  test('compares internal links by path, query, and fragment across configured origins', () => {
    const expected = [
      { text: 'Gói', href: 'https://www.pavietnam.vn/vn/x?a=1#plan', internal: true },
    ];
    const actual = [
      { text: 'Gói', href: 'https://www-ote.pavietnam.vn/vn/x?a=1#plan', internal: true },
    ];
    expect(
      linkDiff(expected, actual, ['https://www.pavietnam.vn', 'https://www-ote.pavietnam.vn']),
    ).toEqual({ missing: [], unexpected: [] });
    expect(
      linkDiff(
        expected,
        [{ ...actual[0], href: 'https://www-ote.pavietnam.vn/vn/x?a=2#plan' }],
        ['https://www.pavietnam.vn', 'https://www-ote.pavietnam.vn'],
      ).missing,
    ).toHaveLength(1);
  });
});
