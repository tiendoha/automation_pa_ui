import { createHash } from 'node:crypto';
import type { ErrorFingerprint } from '../domain/models.js';
export function normalizeUrl(raw: string, ignoredParams: string[]): string {
  const url = new URL(raw);
  for (const key of ignoredParams) url.searchParams.delete(key);
  return url.toString();
}
export function normalizeError(error: string, masks: RegExp[]): string {
  return masks.reduce((text, regex) => text.replace(regex, '[DYNAMIC]'), error);
}
export function createFingerprint(input: Omit<ErrorFingerprint, 'hash'>): ErrorFingerprint {
  const hash = createHash('sha256')
    .update(
      [
        input.environment,
        input.normalizedUrl,
        input.ruleId,
        input.componentOrApiId,
        input.normalizedError,
      ].join('|'),
    )
    .digest('hex');
  return { ...input, hash };
}
