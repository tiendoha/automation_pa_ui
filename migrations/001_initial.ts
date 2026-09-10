import type { MigrationBuilder } from 'node-pg-migrate';
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('pages', {
    id: { type: 'uuid', primaryKey: true },
    environment: { type: 'text', notNull: true },
    normalized_url: { type: 'text', notNull: true },
    page_type: { type: 'text' },
    status: { type: 'text', notNull: true },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint(
    'pages',
    'pages_environment_normalized_url_unique',
    'UNIQUE(environment, normalized_url)',
  );
  pgm.createTable('rules', {
    id: { type: 'text', primaryKey: true },
    tier: { type: 'text', notNull: true },
    target: { type: 'text', notNull: true },
    rule_definition: { type: 'jsonb', notNull: true },
    severity: { type: 'text', notNull: true },
    enabled: { type: 'boolean', notNull: true, default: true },
    version: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createTable('test_runs', {
    id: { type: 'uuid', primaryKey: true },
    page_id: { type: 'uuid', references: 'pages', notNull: true },
    status: { type: 'text', notNull: true },
    started_at: { type: 'timestamptz', notNull: true },
    finished_at: { type: 'timestamptz' },
    retry_count: { type: 'integer', notNull: true, default: 0 },
    summary: { type: 'jsonb', notNull: true, default: '{}' },
  });
  pgm.createTable('test_run_details', {
    id: { type: 'uuid', primaryKey: true },
    test_run_id: { type: 'uuid', references: 'test_runs', notNull: true },
    rule_id: { type: 'text', references: 'rules', notNull: true },
    verdict: { type: 'text', notNull: true },
    severity: { type: 'text', notNull: true },
    expected: { type: 'jsonb' },
    actual: { type: 'jsonb' },
    evidence_reference: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createTable('error_fingerprints', {
    hash: { type: 'text', primaryKey: true },
    environment: { type: 'text', notNull: true },
    normalized_url: { type: 'text', notNull: true },
    rule_id: { type: 'text', notNull: true },
    component_or_api_id: { type: 'text', notNull: true },
    normalized_error: { type: 'text', notNull: true },
    occurrence_count: { type: 'integer', notNull: true, default: 1 },
    state: { type: 'text', notNull: true, default: 'OPEN' },
    first_seen_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    last_seen_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.addConstraint(
    'error_fingerprints',
    'error_fingerprints_hash_environment_unique',
    'UNIQUE(hash, environment)',
  );
  pgm.createTable('baselines', {
    id: { type: 'uuid', primaryKey: true },
    page_id: { type: 'uuid', references: 'pages', notNull: true },
    rule_id: { type: 'text', references: 'rules' },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createTable('alerts', {
    id: { type: 'uuid', primaryKey: true },
    fingerprint_hash: { type: 'text', references: 'error_fingerprints', notNull: true },
    status: { type: 'text', notNull: true, default: 'OPEN' },
    payload: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
}
export async function down(pgm: MigrationBuilder): Promise<void> {
  [
    'alerts',
    'baselines',
    'error_fingerprints',
    'test_run_details',
    'test_runs',
    'rules',
    'pages',
  ].forEach((table) => pgm.dropTable(table));
}
