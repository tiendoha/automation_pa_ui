import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FileEvidenceStore } from '../../src/evidence/file-store.js';
test.describe('evidence store', () =>
  test('writes structured evidence beneath run/page/environment/rule', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pa-evidence-'));
    const store = new FileEvidenceStore(root);
    const path = await store.save(
      {
        runId: 'run',
        pageId: 'page',
        environment: 'ote',
        ruleId: 'rule',
        kind: 'scan_json',
        path: 'output.json',
        createdAt: new Date().toISOString(),
      },
      '{"safe":true}',
    );
    expect(path).toContain('/page/ote/target/rule/');
    expect(await readFile(path, 'utf8')).toContain('safe');
  }));
