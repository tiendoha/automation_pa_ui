import { checkInternalLink, type LinkProber } from '../normalization/link-policy.js';
import type { LinkCheck, PageRegistryEntry, ScanResult } from '../domain/models.js';

export class ReadOnlyLinkProber {
  constructor(
    private readonly concurrency: number,
    private readonly rateLimitMs: number,
  ) {}
  private prober(): LinkProber {
    return async (url, method) => {
      const timeout = method === 'HEAD' ? 5_000 : 8_000;
      let error = 'unknown';
      for (let retry = 0; retry <= 2; retry += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(url, {
            method,
            redirect: 'manual',
            signal: controller.signal,
          });
          return {
            status: response.status,
            redirectedTo: response.headers.get('location') ?? undefined,
          };
        } catch (cause) {
          error = cause instanceof Error ? cause.name : String(cause);
        } finally {
          clearTimeout(timer);
        }
      }
      return { error: `ENVIRONMENT_ERROR:${error}; retries=2` };
    };
  }
  async probe(
    scan: ScanResult,
    page: PageRegistryEntry,
    prior: LinkCheck[] = [],
    onCheckpoint?: (checks: LinkCheck[]) => Promise<void>,
  ): Promise<LinkCheck[]> {
    const complete = new Map(prior.map((item) => [item.resolvedUrl, item]));
    const links = [
      ...new Map(
        scan.model.internalLinks.map((item) => [item.resolvedUrl ?? item.href, item]),
      ).values(),
    ]
      .filter((item) => !complete.has(item.resolvedUrl ?? item.href))
      .slice(0, page.internalLinkPolicy?.maxLinks ?? 0);
    let next = 0;
    const worker = async () => {
      for (;;) {
        const link = links[next++];
        if (!link) return;
        const checked = await checkInternalLink({
          rawHref: link.rawHref ?? link.href,
          resolvedUrl: link.resolvedUrl ?? link.href,
          configuredOrigins: [new URL(scan.requestedUrl).origin],
          currentPageUrl: scan.documentUrl,
          unsafePathPatterns: page.internalLinkPolicy?.unsafePathPatterns,
          sourceText: link.text,
          sourceSelector: 'a[href]',
          prober: this.prober(),
        });
        complete.set(checked.resolvedUrl, checked);
        if (complete.size % 10 === 0) await onCheckpoint?.([...complete.values()]);
        await new Promise((resolve) => setTimeout(resolve, this.rateLimitMs));
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, worker));
    const checks = [...complete.values()];
    await onCheckpoint?.(checks);
    return checks;
  }
}
