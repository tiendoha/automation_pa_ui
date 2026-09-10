import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { RunManifestStore } from '../../src/evidence/run-manifest.js';
import { dailyRunId } from '../../src/orchestration/daily-runner.js';
import { RunLock } from '../../src/orchestration/run-lock.js';
import { assertStageTransition, dailyVerdict } from '../../src/orchestration/state-machine.js';
import { allStagesTerminal, publishDailyReport } from '../../src/reporting/daily-report.js';

test.describe('daily orchestrator', () => {
  test('uses the Vietnam business day at a UTC boundary', () => {
    expect(dailyRunId(new Date('2026-09-10T18:00:00Z'))).toBe('daily-20260911-desktop');
  });
  test('atomic checkpoint retains previous manifest and resumes running work', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pa-daily-'));
    const store = new RunManifestStore(root);
    await store.set('daily-x', 'hosting', 'production', 'production.browser.capture', 'RUNNING');
    await store.set('daily-x', 'hosting', 'production', 'production.browser.capture', 'COMPLETED');
    expect(
      JSON.parse(await readFile(join(root, 'daily-x', 'manifest.previous.json'), 'utf8')).stages
        .hosting['production.browser.capture'].status,
    ).toBe('RUNNING');
    await store.set('daily-x', 'cloud-server', 'ote', 'ote.browser.capture', 'RUNNING');
    expect(
      (await store.checkpointRunning('daily-x')).stages?.['cloud-server']['ote.browser.capture']
        .status,
    ).toBe('CHECKPOINTED');
  });
  test('has bounded terminal publication gate and rejects invalid transition', async () => {
    expect(() => assertStageTransition('COMPLETED', 'RUNNING')).toThrow('Invalid stage transition');
    expect(() => dailyVerdict(['RUNNING'])).toThrow('non-terminal');
    const root = await mkdtemp(join(tmpdir(), 'pa-report-'));
    const store = new RunManifestStore(root);
    await store.set('run', 'hosting', 'batch', 'page.aggregate', 'RUNNING');
    await expect(publishDailyReport(root, await store.load('run'))).rejects.toThrow('non-terminal');
    await store.set('run', 'hosting', 'batch', 'page.aggregate', 'COMPLETED');
    const manifest = await store.load('run');
    expect(allStagesTerminal(manifest)).toBe(true);
    manifest.status = 'COMPLETED';
    await publishDailyReport(root, manifest);
    expect(await readFile(join(root, 'run', 'report.final.md'), 'utf8')).toContain(
      'Daily monitoring report',
    );
  });
  test('lock prevents a duplicate daily runner', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pa-lock-'));
    const first = new RunLock(root, 'run');
    const second = new RunLock(root, 'run');
    await first.acquire();
    await expect(second.acquire()).rejects.toThrow('already locked');
    await first.release();
    await second.acquire();
    await second.release();
  });
  test('fallback manifest is readable when current JSON is corrupt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pa-recovery-'));
    const store = new RunManifestStore(root);
    await store.set('run', 'hosting', 'batch', 'page.aggregate', 'COMPLETED');
    await store.set('run', 'cloud-server', 'batch', 'page.aggregate', 'COMPLETED');
    await writeFile(join(root, 'run', 'manifest.json'), '{bad');
    expect((await store.load('run')).pages.hosting.batch?.['page.aggregate']).toBe('COMPLETED');
  });
});
