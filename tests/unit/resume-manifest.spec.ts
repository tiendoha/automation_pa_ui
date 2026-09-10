import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { RunManifestStore } from '../../src/evidence/run-manifest.js';

test.describe('live scan resume manifest', () => {
  test('persists interruption and retains completed stages for resume skipping', async () => {
    const store = new RunManifestStore(await mkdtemp(join(tmpdir(), 'pa-manifest-')));
    await store.set('run', 'cloud-server', 'ote', 'scan', 'INTERRUPTED_RESUMABLE');
    await store.set('run', 'cloud-server', 'production', 'scan', 'COMPLETED');
    const manifest = await store.load('run');
    expect(manifest.pages['cloud-server'].ote?.scan).toBe('INTERRUPTED_RESUMABLE');
    expect(manifest.pages['cloud-server'].production?.scan).toBe('COMPLETED');
  });
});
