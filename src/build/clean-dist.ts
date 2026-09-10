import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Deletes only this repository's disposable build directory. */
export async function cleanDist(root = process.cwd()): Promise<void> {
  const dist = resolve(root, 'dist');
  const expectedParent = resolve(root);
  if (resolve(dist, '..') !== expectedParent)
    throw new Error(`Refusing to clean unexpected build directory: ${dist}`);
  await rm(dist, { recursive: true, force: true });
}

if (import.meta.url === `file://${process.argv[1]}`) await cleanDist();
