import type {
  PageRegistryEntry,
  RuleDefinition,
  RuleResult,
  ScanResult,
} from '../../domain/models.js';
import { evaluateGlobal } from '../tier1/global.js';
import { evaluatePageType } from '../tier2/page-type.js';

export function evaluateRules(
  page: PageRegistryEntry,
  scan: ScanResult,
  rules: RuleDefinition[],
): RuleResult[] {
  if (scan.role === 'reference') return [];
  return rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      if (rule.tier === 'exception')
        return {
          ruleId: rule.id,
          verdict: 'CONFIG_PENDING',
          severity: rule.severity,
          message: 'Exception precedence is waiting for confirmation.',
        };
      if (rule.tier === 'page_type' && page.status !== 'confirmed')
        return {
          ruleId: rule.id,
          verdict: 'DISABLED',
          severity: rule.severity,
          message: 'Page type rules do not run for unconfirmed pages.',
        };
      if (rule.id === 'unexpected-redirect')
        return {
          ruleId: rule.id,
          verdict: scan.documentUrl === page.urls[scan.environment] ? 'PASS' : 'FAIL',
          severity: rule.severity,
          expected: page.urls[scan.environment],
          actual: scan.documentUrl,
          evidenceReference: scan.screenshotPath,
        };
      return rule.tier === 'global'
        ? evaluateGlobal(rule, scan)
        : evaluatePageType(rule, page, scan);
    });
}
