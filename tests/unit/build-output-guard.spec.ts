import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { cleanDist } from '../../src/build/clean-dist.js';
import { assertDistLayout, findDistLayoutViolations } from '../../src/build/output-guard.js';

test.describe('build output guard', () => {
  test('rejects dist/src and compiled specs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pa-dist-'));
    await mkdir(join(root, 'dist', 'src'), { recursive: true });
    await writeFile(join(root, 'dist', 'src', 'old.js'), '');
    await writeFile(join(root, 'dist', 'example.spec.js'), '');
    await expect(assertDistLayout(root)).rejects.toThrow('Invalid dist layout');
    expect(await findDistLayoutViolations(root)).toHaveLength(2);
  });

  test('clean removes stale dist/src and a valid layout passes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pa-dist-'));
    await mkdir(join(root, 'dist', 'src'), { recursive: true });
    await writeFile(join(root, 'dist', 'src', 'old.js'), '');
    await cleanDist(root);
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(join(root, 'dist', 'cli.js'), '');
    await expect(assertDistLayout(root)).resolves.toBeUndefined();
  });
});
