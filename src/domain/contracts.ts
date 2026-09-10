import type {
  AlertRecord,
  Environment,
  ErrorFingerprint,
  EvidenceRecord,
  PageRegistryEntry,
  RuleDefinition,
  RuleResult,
  ScanResult,
} from './models.js';

export interface RuleRepository {
  listForPage(page: PageRegistryEntry): Promise<RuleDefinition[]>;
}
export interface PageRepository {
  getById(id: string, environment: Environment): Promise<PageRegistryEntry | undefined>;
}
export interface RunRepository {
  create(runId: string, page: PageRegistryEntry, scan: ScanResult): Promise<void>;
  saveRuleResults(runId: string, results: RuleResult[]): Promise<void>;
}
export interface EvidenceStore {
  save(record: EvidenceRecord, body: Buffer | string): Promise<string>;
  cleanupOlderThan(days: number): Promise<number>;
}
export interface NotificationAdapter {
  notify(alert: AlertRecord): Promise<void>;
}
export interface FingerprintRepository {
  recordOpen(fingerprint: ErrorFingerprint): Promise<{ isNew: boolean; occurrenceCount: number }>;
}
