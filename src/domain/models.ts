export type Environment = 'template' | 'production' | 'ote';
export type EnvironmentRole = 'reference' | 'target';
export type RuleTier = 'global' | 'page_type' | 'exception';
export type PageStatus = 'confirmed' | 'pending_classification' | 'disabled';
export type Severity = 'critical' | 'high' | 'medium';
export type Verdict = 'PASS' | 'FAIL' | 'CONFIG_MISSING' | 'CONFIG_PENDING' | 'DISABLED' | 'ERROR';

export interface RuleDefinition {
  id: string;
  tier: RuleTier;
  target: string;
  definition: Record<string, unknown>;
  severity: Severity;
  enabled: boolean;
  version: number;
}

export interface PageRegistryEntry {
  id: string;
  urls: Record<Environment, string>;
  roles: Record<Environment, EnvironmentRole>;
  pageType?: string;
  severity: Severity;
  status: PageStatus;
  selectors?: Record<Environment, Record<string, SelectorConfig>>;
  internalLinkPolicy?: { unsafePathPatterns: string[]; maxLinks: number };
  metadata?: Record<string, unknown>;
}

export interface SelectorConfig {
  selector: string;
  status: 'confirmed' | 'pending';
  cssProperties?: string[];
}

export interface ScanRequest {
  runId: string;
  page: PageRegistryEntry;
  retryDelayMs: number;
  maxRetries: number;
}

export interface NetworkRecord {
  url: string;
  method: string;
  status?: number;
  resourceType: string;
  failure?: string;
  blockReason?: string;
}
export interface LinkCheck {
  /** DOM value and URLs are intentionally all retained for reviewability. */
  rawHref: string;
  resolvedUrl: string;
  canonicalUrl?: string;
  attempts: LinkProbeAttempt[];
  outcome:
    | 'PASS'
    | 'PASS_GET_FALLBACK'
    | 'PASS_CANONICALIZED'
    | 'FAIL'
    | 'INCONCLUSIVE'
    | 'UNSAFE_SKIPPED'
    | 'FORMAT_ONLY';
  reason?: string;
  warning?: 'RAW_URL_404_CANONICAL_OK';
  sourceText?: string;
  sourceSelector?: string;
}

export interface LinkProbeAttempt {
  url: string;
  method: 'HEAD' | 'GET';
  status?: number;
  redirectedTo?: string;
  error?: string;
}

export interface ScanResult {
  pageId: string;
  environment: Environment;
  role: EnvironmentRole;
  requestedUrl: string;
  documentUrl?: string;
  httpStatus?: number;
  redirectChain: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  navigationError?: string;
  consoleMessages: Array<{ type: string; text: string }>;
  pageErrors: string[];
  network: NetworkRecord[];
  linkChecks: LinkCheck[];
  safety: { blockedNonReadRequests: number; completedNonReadRequests: number };
  dom: { rendered: boolean; bodyTextLength: number; horizontalOverflow: boolean };
  model: NormalizedPageModel;
  viewport: { width: number; height: number };
  browser: { name: string; version: string };
  screenshotPath?: string;
  interrupted?: boolean;
}

export interface NormalizedLink {
  text: string;
  /** Retained DOM attribute; href remains the resolved URL for existing comparators. */
  rawHref?: string;
  resolvedUrl?: string;
  href: string;
  internal: boolean;
}
export interface NormalizedSection {
  key: string;
  text: string;
}
export interface SelectorObservation {
  status: 'confirmed' | 'pending';
  selector: string;
  count: number;
  visibleCount: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  text?: string;
  css?: Record<string, string>;
}
export interface NormalizedPageModel {
  sections: NormalizedSection[];
  visibleText: string;
  internalLinks: NormalizedLink[];
  links: NormalizedLink[];
  observations: Record<string, SelectorObservation>;
}

export interface RuleResult {
  ruleId: string;
  verdict: Verdict;
  severity: Severity;
  expected?: unknown;
  actual?: unknown;
  evidenceReference?: string;
  message?: string;
}

export interface EvidenceRecord {
  runId: string;
  pageId: string;
  environment?: Environment;
  ruleId?: string;
  kind: 'screenshot' | 'scan_json';
  path: string;
  createdAt: string;
}

export interface ErrorFingerprint {
  hash: string;
  environment: Environment;
  normalizedUrl: string;
  ruleId: string;
  componentOrApiId: string;
  normalizedError: string;
}

export interface AlertRecord {
  fingerprintHash: string;
  environment: Environment;
  url: string;
  ruleId: string;
  severity: Severity;
  expected?: unknown;
  actual?: unknown;
  evidenceReference?: string;
  occurredAt: string;
}
