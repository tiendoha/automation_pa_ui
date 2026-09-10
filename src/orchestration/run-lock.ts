import { mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';
export class RunLock {
  private readonly path: string;
  constructor(root: string, runId: string) {
    this.path = join(root, runId, '.daily-run.lock');
  }
  async acquire(): Promise<void> {
    await mkdir(join(this.path, '..'), { recursive: true });
    try {
      const handle = await open(this.path, 'wx');
      await handle.writeFile(`${process.pid}\n`);
      await handle.close();
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST')
        throw new Error(`Daily run is already locked: ${this.path}`);
      throw error;
    }
  }
  async release(): Promise<void> {
    try {
      await rm(this.path);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
