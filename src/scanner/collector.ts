import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright';
import type { EvidenceStore } from '../domain/contracts.js';
import type {
  Environment,
  EnvironmentRole,
  LinkCheck,
  PageRegistryEntry,
  ScanResult,
} from '../domain/models.js';
import { modelFromDom } from '../normalization/model.js';

export interface CollectorOptions {
  viewport?: { width: number; height: number };
  timeBudgetMs?: number;
  resumeLinkChecks?: LinkCheck[];
  onLinkCheckpoint?: (checks: LinkCheck[]) => Promise<void>;
}
const redact = (value: string): string =>
  value.replace(/(authorization|cookie|token)=?[^\s;]+/gi, '$1=[REDACTED]');

export class PlaywrightCollector {
  constructor(
    private readonly evidence: EvidenceStore,
    private readonly options: CollectorOptions = {},
  ) {}
  async collect(
    runId: string,
    entry: PageRegistryEntry,
    environment: Environment,
  ): Promise<ScanResult> {
    return entry.roles[environment] === 'reference'
      ? this.captureReference(runId, entry, environment)
      : this.scanTarget(runId, entry, environment);
  }

  /** Captures only stable UI reference data; it deliberately collects no health signals. */
  async captureReference(
    runId: string,
    entry: PageRegistryEntry,
    environment: Environment = 'template',
  ): Promise<ScanResult> {
    return this.collectByRole(runId, entry, environment, 'reference');
  }

  /** Validates a monitored target with read-only network enforcement. */
  async scanTarget(
    runId: string,
    entry: PageRegistryEntry,
    environment: Environment,
  ): Promise<ScanResult> {
    return this.collectByRole(runId, entry, environment, 'target');
  }

  private async collectByRole(
    runId: string,
    entry: PageRegistryEntry,
    environment: Environment,
    role: EnvironmentRole,
  ): Promise<ScanResult> {
    const started = new Date();
    const requestedUrl = entry.urls[environment];
    let browser: Browser | undefined;
    const consoleMessages: Array<{ type: string; text: string }> = [];
    const pageErrors: string[] = [];
    const network: ScanResult['network'] = [];
    const redirectChain: string[] = [];
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: this.options.viewport ?? { width: 1440, height: 900 },
        acceptDownloads: false,
        serviceWorkers: 'block',
      });
      // Targets are navigation-only. Abort every write request before navigation.
      if (role === 'target')
        try {
          await context.route('**/*', async (route) => {
            const request = route.request();
            const method = request.method();
            if (method !== 'GET' && method !== 'HEAD') {
              network.push({
                url: request.url(),
                method,
                resourceType: request.resourceType(),
                failure: 'BLOCKED_BY_CLIENT',
                blockReason: 'read-only policy: only GET and HEAD are allowed',
              });
              await route.abort('blockedbyclient');
              return;
            }
            await route.continue();
          });
        } catch (error) {
          await context.close();
          throw new Error(`Read-only route guard failed before navigation: ${String(error)}`);
        }
      const page = await context.newPage();
      if (role === 'target') {
        page.on('popup', async (popup) => popup.close());
        page.on('download', async (download) => download.cancel());
        page.on('console', (message: ConsoleMessage) =>
          consoleMessages.push({ type: message.type(), text: redact(message.text()) }),
        );
        page.on('pageerror', (error) => pageErrors.push(redact(error.message)));
        page.on('requestfailed', (request) =>
          network.push({
            url: request.url(),
            method: request.method(),
            resourceType: request.resourceType(),
            failure: redact(request.failure()?.errorText ?? 'unknown'),
          }),
        );
        page.on('response', (response) => {
          network.push({
            url: response.url(),
            method: response.request().method(),
            status: response.status(),
            resourceType: response.request().resourceType(),
          });
          if (response.request().isNavigationRequest()) redirectChain.push(response.url());
        });
      }
      let response;
      let navigationError: string | undefined;
      try {
        response = await page.goto(requestedUrl, { waitUntil: 'load', timeout: 30_000 });
      } catch (error) {
        navigationError = redact(error instanceof Error ? error.message : String(error));
      }
      const dom = navigationError
        ? { rendered: false, bodyTextLength: 0, horizontalOverflow: false }
        : await this.readDom(page);
      const model = navigationError
        ? { sections: [], visibleText: '', links: [], internalLinks: [], observations: {} }
        : await this.readModel(page, page.url(), entry.selectors?.[environment] ?? {});
      // Browser work ends at capture. Link probes use the separate Node request client.
      const linkChecks: LinkCheck[] = [];
      const screenshotName = `${environment}-page.png`;
      const screenshot = navigationError ? undefined : await page.screenshot({ fullPage: true });
      const screenshotPath = screenshot
        ? await this.evidence.save(
            {
              runId,
              pageId: entry.id,
              environment,
              kind: 'screenshot',
              path: screenshotName,
              createdAt: new Date().toISOString(),
            },
            screenshot,
          )
        : undefined;
      const finished = new Date();
      const viewport = page.viewportSize() ?? { width: 0, height: 0 };
      const completedNonReadRequests = network.filter(
        (request) =>
          request.status !== undefined && request.method !== 'GET' && request.method !== 'HEAD',
      );
      if (completedNonReadRequests.length > 0) {
        await context.close();
        throw new Error(
          `Read-only invariant violated: ${completedNonReadRequests.length} non-GET/HEAD request(s) completed.`,
        );
      }
      await context.close();
      return {
        pageId: entry.id,
        environment,
        role,
        requestedUrl,
        documentUrl: page.url(),
        httpStatus: response?.status(),
        redirectChain,
        startedAt: started.toISOString(),
        finishedAt: finished.toISOString(),
        durationMs: finished.getTime() - started.getTime(),
        navigationError,
        consoleMessages,
        pageErrors,
        network,
        linkChecks,
        safety: {
          blockedNonReadRequests: network.filter((request) => request.blockReason !== undefined)
            .length,
          completedNonReadRequests: 0,
        },
        dom,
        model,
        viewport,
        browser: { name: 'chromium', version: browser.version() },
        screenshotPath,
        interrupted: false,
      };
    } finally {
      await browser?.close();
    }
  }
  private async readDom(page: Page): Promise<ScanResult['dom']> {
    return page.evaluate(() => ({
      rendered: document.readyState === 'complete' && Boolean(document.body),
      bodyTextLength: document.body?.innerText.length ?? 0,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
  }
  private async readModel(
    page: Page,
    documentUrl: string,
    selectors: NonNullable<PageRegistryEntry['selectors']>[Environment],
  ): Promise<ScanResult['model']> {
    const result = await page.evaluate((configured) => {
      const observations: ScanResult['model']['observations'] = {};
      for (const [key, config] of Object.entries(configured)) {
        const elements = Array.from(document.querySelectorAll(config.selector));
        const first = elements[0];
        observations[key] = {
          status: config.status,
          selector: config.selector,
          count: elements.length,
          visibleCount: elements.filter((element) => {
            const style = window.getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return (
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              box.width > 0 &&
              box.height > 0
            );
          }).length,
          boundingBox: first
            ? (() => {
                const box = first.getBoundingClientRect();
                return { x: box.x, y: box.y, width: box.width, height: box.height };
              })()
            : undefined,
          text: first?.textContent ?? '',
          css: first
            ? Object.fromEntries(
                (config.cssProperties ?? []).map((property) => [
                  property,
                  window.getComputedStyle(first).getPropertyValue(property),
                ]),
              )
            : undefined,
        };
      }
      const sectionElements = Array.from(
        document.querySelectorAll(configured.sections?.selector ?? ''),
      );
      return {
        visibleText: document.body?.innerText ?? '',
        sections: sectionElements.map((element) => ({
          key:
            element.id ||
            Array.from(element.classList)
              .filter((name) => !/^(wow|animated|fade)/u.test(name))
              .sort()
              .join('.') ||
            element.tagName.toLowerCase(),
          text: element.textContent ?? '',
        })),
        links: Array.from(document.querySelectorAll('a[href]')).map((anchor) => ({
          text: anchor.textContent ?? '',
          href: anchor.getAttribute('href') ?? (anchor as HTMLAnchorElement).href,
        })),
        observations,
      };
    }, selectors);
    return modelFromDom(
      documentUrl,
      result.visibleText,
      result.sections,
      result.links,
      result.observations,
    );
  }
}
