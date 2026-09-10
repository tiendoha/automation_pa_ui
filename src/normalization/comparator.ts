import type {
  NormalizedLink,
  NormalizedPageModel,
  RuleResult,
  Severity,
} from '../domain/models.js';
import { canonicalRouteKey } from './link-policy.js';

const difference = <T>(left: T[], right: T[], key: (value: T) => string): T[] => {
  const rightKeys = new Set(right.map(key));
  return left.filter((value) => !rightKeys.has(key(value)));
};

export function sectionOrderDiff(expected: NormalizedPageModel, actual: NormalizedPageModel) {
  const expectedKeys = expected.sections.map((section) => section.key);
  const actualKeys = actual.sections.map((section) => section.key);
  return {
    expected: expectedKeys,
    actual: actualKeys,
    matches: JSON.stringify(expectedKeys) === JSON.stringify(actualKeys),
  };
}

export function linkDiff(
  expected: NormalizedLink[],
  actual: NormalizedLink[],
  environmentOrigins: string[] = [],
) {
  const origins = new Set(environmentOrigins);
  const key = (link: NormalizedLink) => {
    const url = new URL(link.href);
    const comparableUrl =
      link.internal && origins.has(url.origin) ? canonicalRouteKey(link.href, origins) : link.href;
    return `${link.text}\u0000${comparableUrl}`;
  };
  return {
    missing: difference(expected, actual, key),
    unexpected: difference(actual, expected, key),
  };
}

export function comparisonResults(
  template: NormalizedPageModel,
  ote: NormalizedPageModel,
  production: NormalizedPageModel,
  severity: Severity,
  evidenceReference?: string,
  environmentOrigins: string[] = [],
): RuleResult[] {
  const templateComparisons = (name: string, actual: NormalizedPageModel): RuleResult[] => {
    const structure = sectionOrderDiff(template, actual);
    const css = ['mainContent', 'sections'].map((key) => ({
      component: key,
      expected: template.observations[key]?.css ?? {},
      actual: actual.observations[key]?.css ?? {},
    }));
    return [
      {
        ruleId: `compare-${name}-template-section-order`,
        verdict: structure.matches ? 'PASS' : 'FAIL',
        severity,
        expected: structure.expected,
        actual: structure.actual,
        evidenceReference,
      },
      {
        ruleId: `compare-${name}-template-layout-css`,
        verdict: css.every((diff) => JSON.stringify(diff.expected) === JSON.stringify(diff.actual))
          ? 'PASS'
          : 'FAIL',
        severity,
        expected: css.map((diff) => ({ component: diff.component, css: diff.expected })),
        actual: css,
        evidenceReference,
      },
    ];
  };
  const links = linkDiff(production.internalLinks, ote.internalLinks, environmentOrigins);
  const components = ['megaMenu', 'footerDesktop'].map((key) => ({
    component: key,
    expected: production.observations[key],
    actual: ote.observations[key],
  }));
  return [
    ...templateComparisons('production', production),
    ...templateComparisons('ote', ote),
    {
      ruleId: 'compare-ote-production-visible-text',
      verdict: production.visibleText === ote.visibleText ? 'PASS' : 'FAIL',
      severity,
      expected: production.visibleText,
      actual: ote.visibleText,
      evidenceReference,
    },
    {
      ruleId: 'compare-ote-production-internal-links',
      verdict: links.missing.length || links.unexpected.length ? 'FAIL' : 'PASS',
      severity,
      expected: { count: production.links.length },
      actual: {
        count: ote.links.length,
        missing: links.missing,
        unexpected: links.unexpected,
      },
      evidenceReference,
    },
    {
      ruleId: 'compare-ote-production-global-components',
      verdict: components.every(
        (diff) => JSON.stringify(diff.expected) === JSON.stringify(diff.actual),
      )
        ? 'PASS'
        : 'FAIL',
      severity,
      expected: components.map((diff) => ({ component: diff.component, value: diff.expected })),
      actual: components,
      evidenceReference,
    },
  ];
}
