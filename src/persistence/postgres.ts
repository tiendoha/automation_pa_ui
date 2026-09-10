import type { Pool } from 'pg';
import type { FingerprintRepository, PageRepository, RunRepository } from '../domain/contracts.js';
import type {
  ErrorFingerprint,
  Environment,
  PageRegistryEntry,
  RuleResult,
  ScanResult,
} from '../domain/models.js';
import { randomUUID } from 'node:crypto';

export class PostgresPageRepository implements PageRepository {
  constructor(private readonly pool: Pool) {}
  async getById(id: string, environment: Environment): Promise<PageRegistryEntry | undefined> {
    const result = await this.pool.query<{
      id: string;
      environment: Environment;
      normalized_url: string;
      page_type: string | null;
      status: PageRegistryEntry['status'];
      metadata: Record<string, unknown>;
    }>(
      'SELECT id, environment, normalized_url, page_type, status, metadata FROM pages WHERE id = $1 AND environment = $2',
      [id, environment],
    );
    const row = result.rows[0];
    return (
      row && {
        id: row.id,
        urls: {
          template: row.normalized_url,
          ote: row.normalized_url,
          production: row.normalized_url,
        },
        roles: { template: 'reference', ote: 'target', production: 'target' },
        pageType: row.page_type ?? undefined,
        severity: 'medium',
        status: row.status,
        metadata: row.metadata,
      }
    );
  }
}

export class PostgresRunRepository implements RunRepository {
  constructor(private readonly pool: Pool) {}
  async create(runId: string, page: PageRegistryEntry, scan: ScanResult): Promise<void> {
    await this.pool.query(
      'INSERT INTO test_runs (id, page_id, status, started_at, finished_at, summary) VALUES ($1,$2,$3,$4,$5,$6)',
      [
        runId,
        page.id,
        scan.navigationError ? 'ERROR' : 'COMPLETED',
        scan.startedAt,
        scan.finishedAt,
        JSON.stringify({
          httpStatus: scan.httpStatus,
          durationMs: scan.durationMs,
          navigationError: scan.navigationError,
        }),
      ],
    );
  }
  async saveRuleResults(runId: string, results: RuleResult[]): Promise<void> {
    for (const result of results)
      await this.pool.query(
        'INSERT INTO test_run_details (id, test_run_id, rule_id, verdict, severity, expected, actual, evidence_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          randomUUID(),
          runId,
          result.ruleId,
          result.verdict,
          result.severity,
          result.expected === undefined ? null : JSON.stringify(result.expected),
          result.actual === undefined ? null : JSON.stringify(result.actual),
          result.evidenceReference ?? null,
        ],
      );
  }
}
export class PostgresFingerprintRepository implements FingerprintRepository {
  constructor(private readonly pool: Pool) {}
  async recordOpen(
    fingerprint: ErrorFingerprint,
  ): Promise<{ isNew: boolean; occurrenceCount: number }> {
    const existing = await this.pool.query<{ occurrence_count: number }>(
      'SELECT occurrence_count FROM error_fingerprints WHERE hash = $1 AND environment = $2 AND state = $3',
      [fingerprint.hash, fingerprint.environment, 'OPEN'],
    );
    if (existing.rowCount) {
      const updated = await this.pool.query<{ occurrence_count: number }>(
        'UPDATE error_fingerprints SET occurrence_count = occurrence_count + 1, last_seen_at = CURRENT_TIMESTAMP WHERE hash = $1 AND environment = $2 RETURNING occurrence_count',
        [fingerprint.hash, fingerprint.environment],
      );
      return { isNew: false, occurrenceCount: updated.rows[0].occurrence_count };
    }
    await this.pool.query(
      'INSERT INTO error_fingerprints (hash, environment, normalized_url, rule_id, component_or_api_id, normalized_error) VALUES ($1,$2,$3,$4,$5,$6)',
      [
        fingerprint.hash,
        fingerprint.environment,
        fingerprint.normalizedUrl,
        fingerprint.ruleId,
        fingerprint.componentOrApiId,
        fingerprint.normalizedError,
      ],
    );
    return { isNew: true, occurrenceCount: 1 };
  }
}
