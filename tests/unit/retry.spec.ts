import { expect, test } from '@playwright/test';
import { retry } from '../../src/scanner/retry.js';
test.describe('retry', () =>
  test('retries failed tasks at most twice', async () => {
    let count = 0;
    const result = await retry(
      async () => {
        count += 1;
        if (count < 3) throw new Error('temporary');
        return 'ok';
      },
      2,
      0,
    );
    expect(result).toEqual({ value: 'ok', retryCount: 2 });
  }));
