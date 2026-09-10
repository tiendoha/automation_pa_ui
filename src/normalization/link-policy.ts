import type { LinkCheck, LinkProbeAttempt } from '../domain/models.js';

const FILE_EXTENSION =
  /\.(?:css|js|json|xml|jpe?g|png|gif|svg|webp|ico|pdf|zip|txt|woff2?|ttf|map)$/iu;
const DEFAULT_UNSAFE =
  /(^|\/)(?:logout|signout|delete|remove|submit|order(?:[-_/]|$)|cart(?:[-_/]|$)|precart|payment|upload)(?:\/|$|\?)/iu;

export interface LinkProbeResponse {
  status?: number;
  redirectedTo?: string;
  error?: string;
}

export type LinkProber = (url: string, method: 'HEAD' | 'GET') => Promise<LinkProbeResponse>;

export const isSuccessfulProbe = (status: number | undefined): boolean =>
  typeof status === 'number' && status >= 200 && status < 400;

export function canonicalTrailingSlashUrl(
  resolvedUrl: string,
  configuredOrigins: Iterable<string>,
  unsafePathPatterns: string[] = [],
): string | undefined {
  const url = new URL(resolvedUrl);
  if (!new Set(configuredOrigins).has(url.origin)) return undefined;
  if (url.pathname === '/' || url.pathname.endsWith('/') || FILE_EXTENSION.test(url.pathname))
    return undefined;
  const unsafe = [
    DEFAULT_UNSAFE,
    ...unsafePathPatterns.map((pattern) => new RegExp(pattern, 'iu')),
  ];
  if (unsafe.some((pattern) => pattern.test(`${url.pathname}${url.search}`))) return undefined;
  url.pathname = `${url.pathname}/`;
  return url.toString();
}

/** Stable logical key for OTE/Production comparison; origin is intentionally collapsed. */
export function canonicalRouteKey(
  value: string,
  configuredOrigins: Iterable<string>,
  unsafePathPatterns: string[] = [],
): string {
  const url = new URL(value);
  const canonical = canonicalTrailingSlashUrl(
    url.toString(),
    configuredOrigins,
    unsafePathPatterns,
  );
  const comparable = new URL(canonical ?? url.toString());
  return `${comparable.pathname}${comparable.search}${comparable.hash}`;
}

const attempt = async (
  prober: LinkProber,
  attempts: LinkProbeAttempt[],
  url: string,
  method: 'HEAD' | 'GET',
): Promise<LinkProbeResponse> => {
  const response = await prober(url, method);
  attempts.push({ url, method, ...response });
  return response;
};

/** Executes only read requests and exposes every decision in the returned evidence. */
export async function checkInternalLink(input: {
  rawHref: string;
  resolvedUrl: string;
  configuredOrigins: string[];
  currentPageUrl?: string;
  unsafePathPatterns?: string[];
  sourceText?: string;
  sourceSelector?: string;
  prober: LinkProber;
}): Promise<LinkCheck> {
  const unsafePatterns = input.unsafePathPatterns ?? [];
  const url = new URL(input.resolvedUrl);
  const base = {
    rawHref: input.rawHref,
    resolvedUrl: input.resolvedUrl,
    attempts: [] as LinkProbeAttempt[],
    sourceText: input.sourceText,
    sourceSelector: input.sourceSelector,
  };
  if (url.hash && input.currentPageUrl && url.pathname === new URL(input.currentPageUrl).pathname) {
    return { ...base, outcome: 'FORMAT_ONLY', reason: 'hash-only same-page link' };
  }
  const unsafe = [DEFAULT_UNSAFE, ...unsafePatterns.map((pattern) => new RegExp(pattern, 'iu'))];
  if (unsafe.some((pattern) => pattern.test(`${url.pathname}${url.search}`))) {
    return { ...base, outcome: 'UNSAFE_SKIPPED', reason: 'matches unsafe route policy' };
  }
  const head = await attempt(input.prober, base.attempts, input.resolvedUrl, 'HEAD');
  if (isSuccessfulProbe(head.status)) return { ...base, outcome: 'PASS' };
  const get = await attempt(input.prober, base.attempts, input.resolvedUrl, 'GET');
  if (isSuccessfulProbe(get.status)) return { ...base, outcome: 'PASS_GET_FALLBACK' };
  if (get.status === 0 || get.status === undefined || get.error)
    return {
      ...base,
      outcome: 'INCONCLUSIVE',
      reason: get.error ?? 'HTTP_STATUS_0_NO_RESPONSE: ENVIRONMENT_ERROR',
    };
  // Canonicalization is deliberately only an answer to a genuine raw-route 404.
  if (get.status !== 404)
    return {
      ...base,
      outcome: 'FAIL',
      reason: get.error ?? `GET status ${get.status ?? 'unknown'}`,
    };
  const canonicalUrl = canonicalTrailingSlashUrl(
    input.resolvedUrl,
    input.configuredOrigins,
    unsafePatterns,
  );
  if (!canonicalUrl)
    return {
      ...base,
      outcome: 'FAIL',
      reason: 'raw URL returned 404 and is not eligible for trailing-slash canonicalization',
    };
  const canonicalHead = await attempt(input.prober, base.attempts, canonicalUrl, 'HEAD');
  if (isSuccessfulProbe(canonicalHead.status)) {
    return {
      ...base,
      canonicalUrl,
      outcome: 'PASS_CANONICALIZED',
      warning: 'RAW_URL_404_CANONICAL_OK',
    };
  }
  const canonicalGet = await attempt(input.prober, base.attempts, canonicalUrl, 'GET');
  if (isSuccessfulProbe(canonicalGet.status)) {
    return {
      ...base,
      canonicalUrl,
      outcome: 'PASS_CANONICALIZED',
      warning: 'RAW_URL_404_CANONICAL_OK',
    };
  }
  return {
    ...base,
    canonicalUrl,
    outcome: 'FAIL',
    reason: canonicalGet.error ?? `canonical GET status ${canonicalGet.status ?? 'unknown'}`,
  };
}
