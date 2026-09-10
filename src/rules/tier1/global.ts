import type { RuleDefinition, RuleResult, ScanResult } from '../../domain/models.js';

const missing = (rule: RuleDefinition, message: string): RuleResult => ({
  ruleId: rule.id,
  verdict: 'CONFIG_MISSING',
  severity: rule.severity,
  message,
});
const pending = (rule: RuleDefinition, message: string): RuleResult => ({
  ruleId: rule.id,
  verdict: 'CONFIG_PENDING',
  severity: rule.severity,
  message,
});
const passFail = (
  rule: RuleDefinition,
  pass: boolean,
  expected: unknown,
  actual: unknown,
  scan: ScanResult,
): RuleResult => ({
  ruleId: rule.id,
  verdict: pass ? 'PASS' : 'FAIL',
  severity: rule.severity,
  expected,
  actual,
  evidenceReference: scan.screenshotPath,
});

export function evaluateGlobal(rule: RuleDefinition, scan: ScanResult): RuleResult {
  const d = rule.definition;
  switch (rule.id) {
    case 'http-status': {
      const max = d.maxStatus;
      if (typeof max !== 'number') return missing(rule, 'maxStatus is required.');
      return passFail(
        rule,
        typeof scan.httpStatus === 'number' && scan.httpStatus <= max,
        `HTTP <= ${max}`,
        scan.httpStatus,
        scan,
      );
    }
    case 'unexpected-redirect':
      return missing(rule, 'Expected final URL must be resolved from the page mapping.');
    case 'page-timeout':
      if (typeof d.maxDurationMs !== 'number') return missing(rule, 'maxDurationMs is required.');
      return passFail(
        rule,
        !scan.navigationError && scan.durationMs <= d.maxDurationMs,
        `<= ${d.maxDurationMs}ms`,
        { durationMs: scan.durationMs, navigationError: scan.navigationError },
        scan,
      );
    case 'blank-page':
      if (typeof d.minBodyTextLength !== 'number')
        return missing(rule, 'minBodyTextLength is required.');
      return passFail(
        rule,
        scan.dom.rendered && scan.dom.bodyTextLength >= d.minBodyTextLength,
        { rendered: true, minBodyTextLength: d.minBodyTextLength },
        scan.dom,
        scan,
      );
    case 'screenshot-evidence':
      return passFail(
        rule,
        Boolean(scan.screenshotPath),
        'screenshot path',
        scan.screenshotPath,
        scan,
      );
    case 'layout-frame': {
      const main = scan.model.observations.mainContent;
      const header = scan.model.observations.header;
      if (!main) return missing(rule, 'mainContent selector is required.');
      if (!header || main.status === 'pending' || header.status === 'pending')
        return pending(rule, 'Main or sticky-header selector awaits approval.');
      const headerBottom = (header.boundingBox?.y ?? 0) + (header.boundingBox?.height ?? 0);
      const mainCovered =
        (main.boundingBox?.y ?? Number.POSITIVE_INFINITY) < headerBottom && headerBottom > 0;
      return passFail(
        rule,
        !scan.dom.horizontalOverflow && main.visibleCount > 0 && !mainCovered,
        { horizontalOverflow: false, mainContentVisible: true, notCoveredByHeader: true },
        {
          horizontalOverflow: scan.dom.horizontalOverflow,
          mainContentVisible: main.visibleCount > 0,
          mainCovered,
        },
        scan,
      );
    }
    case 'critical-resource': {
      const coreTypes = d.coreResourceTypes;
      if (!Array.isArray(coreTypes) || !coreTypes.every((type) => typeof type === 'string'))
        return missing(rule, 'coreResourceTypes is required.');
      const origin = new URL(scan.documentUrl ?? scan.requestedUrl).origin;
      const linkProbeUrls = new Set(
        scan.linkChecks.flatMap((check) => check.attempts.map((attempt) => attempt.url)),
      );
      const failures = scan.network.filter((request) => {
        try {
          return (
            Boolean(request.failure) &&
            !linkProbeUrls.has(request.url) &&
            new URL(request.url).origin === origin &&
            coreTypes.includes(request.resourceType)
          );
        } catch {
          return false;
        }
      });
      return passFail(
        rule,
        failures.length === 0,
        { coreResourceTypes: coreTypes },
        failures,
        scan,
      );
    }
    case 'critical-console': {
      if (!Array.isArray(d.thirdPartyIgnorePatterns))
        return missing(rule, 'thirdPartyIgnorePatterns is required.');
      const ignored = d.thirdPartyIgnorePatterns
        .filter((pattern): pattern is string => typeof pattern === 'string')
        .map((pattern) => new RegExp(pattern, 'iu'));
      const errors = [
        ...scan.pageErrors,
        ...scan.consoleMessages
          .filter((message) => message.type === 'error')
          .map((message) => message.text),
      ].filter(
        (message) =>
          // This exact browser message is emitted for requests the scanner's own
          // read-only guard aborted and is retained separately in safety evidence.
          !message.includes('net::ERR_BLOCKED_BY_CLIENT') &&
          !ignored.some((pattern) => pattern.test(message)),
      );
      return passFail(
        rule,
        errors.length === 0,
        { pageErrors: 0, unclassifiedConsoleErrors: 0 },
        errors,
        scan,
      );
    }
    case 'internal-critical-link': {
      if (typeof d.requireLinkChecks !== 'boolean')
        return missing(rule, 'requireLinkChecks is required.');
      const failures = scan.linkChecks.filter((check) => check.outcome === 'FAIL');
      const checked = scan.linkChecks.filter((check) =>
        ['PASS', 'PASS_GET_FALLBACK', 'PASS_CANONICALIZED'].includes(check.outcome),
      ).length;
      return passFail(
        rule,
        checked > 0 && failures.length === 0,
        { checkedAtLeast: 1, failed: 0 },
        {
          checked,
          rawPass: scan.linkChecks.filter((check) => check.outcome === 'PASS').length,
          getFallbackPass: scan.linkChecks.filter((check) => check.outcome === 'PASS_GET_FALLBACK')
            .length,
          canonicalizedPass: scan.linkChecks.filter(
            (check) => check.outcome === 'PASS_CANONICALIZED',
          ).length,
          failures,
          unsafeSkipped: scan.linkChecks.filter((check) => check.outcome === 'UNSAFE_SKIPPED'),
        },
        scan,
      );
    }
    case 'mega-menu':
    case 'footer-desktop': {
      const selectorKey = d.selectorKey;
      if (typeof selectorKey !== 'string') return missing(rule, 'selectorKey is required.');
      const component = scan.model.observations[selectorKey];
      if (!component) return missing(rule, `Selector ${selectorKey} is required.`);
      if (component.status === 'pending')
        return pending(rule, `Selector ${component.selector} awaits approval.`);
      return passFail(
        rule,
        component.count === 1 && component.visibleCount === 1,
        { count: 1, visibleCount: 1 },
        component,
        scan,
      );
    }
    default:
      return missing(rule, 'Unknown global rule implementation.');
  }
}
