import type {
  PageRegistryEntry,
  RuleDefinition,
  RuleResult,
  ScanResult,
} from '../../domain/models.js';
export function evaluatePageType(
  rule: RuleDefinition,
  page: PageRegistryEntry,
  scan: ScanResult,
): RuleResult {
  if (!page.pageType || rule.target !== page.pageType)
    return {
      ruleId: rule.id,
      verdict: 'DISABLED',
      severity: rule.severity,
      message: 'Rule does not target this confirmed page type.',
    };
  const key = rule.definition.selectorKey;
  const minCount = rule.definition.minCount;
  if (typeof key !== 'string' || typeof minCount !== 'number')
    return {
      ruleId: rule.id,
      verdict: 'CONFIG_MISSING',
      severity: rule.severity,
      message: 'selectorKey and minCount are required.',
    };
  const observation = scan.model.observations[key];
  if (!observation)
    return {
      ruleId: rule.id,
      verdict: 'CONFIG_MISSING',
      severity: rule.severity,
      message: `Selector ${key} is absent from this environment config.`,
    };
  if (observation.status === 'pending')
    return {
      ruleId: rule.id,
      verdict: 'CONFIG_PENDING',
      severity: rule.severity,
      expected: { selectorKey: key, minCount },
      actual: observation,
      message: `Selector ${observation.selector} is proposed but not approved.`,
    };
  return {
    ruleId: rule.id,
    verdict: observation.visibleCount >= minCount ? 'PASS' : 'FAIL',
    severity: rule.severity,
    expected: { selectorKey: key, minCount },
    actual: observation,
    evidenceReference: scan.screenshotPath,
  };
}
