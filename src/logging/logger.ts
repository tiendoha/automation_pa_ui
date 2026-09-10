import type { Environment } from '../domain/models.js';
export function log(
  event: string,
  fields: {
    runId?: string;
    environment?: Environment;
    pageId?: string;
    ruleId?: string;
    fingerprint?: string;
    [key: string]: unknown;
  } = {},
): void {
  process.stdout.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields })}\n`,
  );
}
