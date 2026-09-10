import { access, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export interface DistLayoutViolation {
  path: string;
  reason: string;
}

const forbiddenName = (name: string): string | undefined => {
  if (name.endsWith('.ts')) return 'TypeScript source was emitted';
  if (/\.(?:spec|test)\.js$/u.test(name)) return 'compiled test/spec was emitted';
  return undefined;
};

/** Returns every build artifact forbidden by the published build contract. */
export async function findDistLayoutViolations(
  root = process.cwd(),
): Promise<DistLayoutViolation[]> {
  const dist = resolve(root, 'dist');
  try {
    await access(dist);
  } catch {
    return [{ path: dist, reason: 'dist directory was not created' }];
  }
  const violations: DistLayoutViolation[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const relativePath = relative(dist, path);
      const firstSegment = relativePath.split(sep)[0];
      if (entry.isDirectory() && (firstSegment === 'src' || firstSegment === 'tests')) {
        violations.push({ path, reason: `forbidden dist/${firstSegment} directory` });
        continue;
      }
      if (entry.isDirectory()) await walk(path);
      else {
        const reason = forbiddenName(entry.name);
        if (reason) violations.push({ path, reason });
      }
    }
  };
  await walk(dist);
  return violations;
}

export async function assertDistLayout(root = process.cwd()): Promise<void> {
  const violations = await findDistLayoutViolations(root);
  if (violations.length)
    throw new Error(
      `Invalid dist layout:\n${violations.map((item) => `- ${item.path}: ${item.reason}`).join('\n')}`,
    );
}

if (import.meta.url === `file://${process.argv[1]}`) await assertDistLayout();
