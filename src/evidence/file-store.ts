import { mkdir, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvidenceRecord } from '../domain/models.js';
import type { EvidenceStore } from '../domain/contracts.js';

export class FileEvidenceStore implements EvidenceStore {
  constructor(private readonly root: string) {}
  async save(record: EvidenceRecord, body: Buffer | string): Promise<string> {
    const dir = join(
      this.root,
      record.runId,
      record.pageId,
      record.environment
        ? join(record.environment, record.environment === 'template' ? 'reference' : 'target')
        : 'shared',
      record.ruleId ?? 'collector',
    );
    await mkdir(dir, { recursive: true });
    const path = join(dir, record.path);
    await writeFile(path, body);
    return path;
  }
  async cleanupOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 86_400_000;
    let removed = 0;
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if ((await stat(path)).mtimeMs < cutoff) {
          await rm(path);
          removed += 1;
        }
      }
    };
    try {
      await walk(this.root);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return removed;
  }
}
