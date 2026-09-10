import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { pageSchema, ruleSchema } from './schema.js';
import type { PageRegistryEntry, RuleDefinition } from '../domain/models.js';

async function loadConfig(path: string): Promise<unknown> {
  const content = await readFile(path, 'utf8');
  return path.endsWith('.yaml') || path.endsWith('.yml')
    ? parse(content)
    : (JSON.parse(content) as unknown);
}
export async function loadPage(path: string): Promise<PageRegistryEntry> {
  return pageSchema.parse(await loadConfig(path)) as PageRegistryEntry;
}

/** Loads every declarative page registration without page-specific framework code. */
export async function loadPageRegistry(directory: string): Promise<PageRegistryEntry[]> {
  const files = (await readdir(directory)).filter((file) => /\.ya?ml$/iu.test(file)).sort();
  return Promise.all(files.map((file) => loadPage(join(directory, file))));
}
export async function loadRules(path: string): Promise<RuleDefinition[]> {
  return ruleSchema.array().parse(await loadConfig(path));
}
