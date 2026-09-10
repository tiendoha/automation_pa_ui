import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPageRegistry, loadRules } from '../config/loaders.js';
import { FileEvidenceStore } from '../evidence/file-store.js';
import {
  RunManifestStore,
  isTerminal,
  type LiveStage,
  type RunManifest,
} from '../evidence/run-manifest.js';
import { comparisonResults } from '../normalization/comparator.js';
import { publishDailyReport } from '../reporting/daily-report.js';
import { evaluateRules } from '../rules/engine/engine.js';
import { PlaywrightCollector } from '../scanner/collector.js';
import { ReadOnlyLinkProber } from '../scanner/link-prober.js';
import type { Environment, PageRegistryEntry, ScanResult } from '../domain/models.js';
import { BrowserSupervisor } from './browser-supervisor.js';
import { RunLock } from './run-lock.js';
import { dailyVerdict } from './state-machine.js';

const stages: LiveStage[] = [
  'template.reference.capture',
  'production.browser.capture',
  'production.links.probe',
  'production.rules.evaluate',
  'ote.browser.capture',
  'ote.links.probe',
  'ote.rules.evaluate',
  'template.target.compare',
  'ote.production.compare',
  'page.aggregate',
];
const businessDate = (date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(date)
    .replaceAll('-', '');
export const dailyRunId = (date?: Date): string => `daily-${businessDate(date)}-desktop`;
const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const environmentFor = (stage: LiveStage): Environment | 'batch' =>
  stage.startsWith('template.')
    ? 'template'
    : stage.startsWith('production.')
      ? 'production'
      : stage.startsWith('ote.')
        ? 'ote'
        : 'batch';

export class DailyRunner {
  constructor(private readonly root = process.env.EVIDENCE_ROOT ?? './evidence') {}
  async status(runId: string): Promise<RunManifest> {
    return new RunManifestStore(this.root).load(runId);
  }
  async run(
    options: { date?: Date; pages?: string[]; forceNew?: boolean; deadline?: Date } = {},
  ): Promise<RunManifest> {
    const runId = options.forceNew
      ? `${dailyRunId(options.date)}-r${Date.now()}`
      : dailyRunId(options.date);
    const store = new RunManifestStore(this.root);
    const lock = new RunLock(this.root, runId);
    await lock.acquire();
    try {
      const registry = (await loadPageRegistry(resolve('config/pages'))).filter(
        (page) => page.status !== 'disabled' && (!options.pages || options.pages.includes(page.id)),
      );
      const rules = await loadRules(resolve('config/rules/pilot-rules.yaml'));
      let manifest = await store.load(runId);
      const configHash = hash(registry);
      const ruleHash = hash(rules);
      if (
        manifest.configHash &&
        (manifest.configHash !== configHash || manifest.ruleHash !== ruleHash)
      )
        throw new Error('STALE_CONFIG: manifest hashes differ; use --force-new.');
      if (manifest.stages && Object.keys(manifest.stages).length)
        manifest = await store.checkpointRunning(runId);
      Object.assign(manifest, {
        dailyRunId: runId,
        businessDate: businessDate(options.date),
        timezone: 'Asia/Ho_Chi_Minh',
        status: 'RUNNING',
        configHash,
        ruleHash,
        registryPageIds: registry.map((page) => page.id),
        publicationState: 'PENDING',
      });
      await store.save(manifest);
      for (const page of registry)
        for (const stage of stages) {
          manifest = await store.load(runId);
          if (isTerminal(manifest.stages?.[page.id]?.[stage]?.status)) continue;
          if (options.deadline && new Date() >= options.deadline) {
            await store.set(
              runId,
              page.id,
              environmentFor(stage),
              stage,
              'INCONCLUSIVE_ENVIRONMENT',
              { note: 'INCONCLUSIVE_DAILY_DEADLINE' },
            );
            continue;
          }
          const dependency = this.dependencyFor(stage);
          if (
            dependency &&
            manifest.stages?.[page.id]?.[dependency]?.status === 'INCONCLUSIVE_ENVIRONMENT'
          ) {
            await store.set(
              runId,
              page.id,
              environmentFor(stage),
              stage,
              'INCONCLUSIVE_ENVIRONMENT',
              {
                note: `INCONCLUSIVE_DEPENDENCY:${dependency}`,
              },
            );
            continue;
          }
          await this.execute(store, runId, page, stage, rules);
        }
      manifest = await store.load(runId);
      const statuses = Object.values(manifest.stages ?? {}).flatMap((byStage) =>
        Object.values(byStage).map((record) => record.status),
      );
      manifest.status = dailyVerdict(statuses);
      manifest.completedAt = new Date().toISOString();
      manifest.publicationState = 'PUBLISHED';
      await store.save(manifest);
      await publishDailyReport(this.root, manifest);
      return manifest;
    } finally {
      await lock.release();
    }
  }
  private dependencyFor(stage: LiveStage): LiveStage | undefined {
    const dependencies: Partial<Record<LiveStage, LiveStage>> = {
      'production.links.probe': 'production.browser.capture',
      'production.rules.evaluate': 'production.browser.capture',
      'ote.links.probe': 'ote.browser.capture',
      'ote.rules.evaluate': 'ote.browser.capture',
      'template.target.compare': 'template.reference.capture',
      'ote.production.compare': 'template.reference.capture',
    };
    return dependencies[stage];
  }
  private async execute(
    store: RunManifestStore,
    runId: string,
    page: PageRegistryEntry,
    stage: LiveStage,
    rules: Awaited<ReturnType<typeof loadRules>>,
  ): Promise<void> {
    const env = environmentFor(stage);
    await store.set(runId, page.id, env, stage, 'RUNNING');
    try {
      const evidence = new FileEvidenceStore(this.root);
      const scanPath = (environment: Environment) =>
        join(
          this.root,
          runId,
          page.id,
          environment,
          environment === 'template' ? 'reference' : 'target',
          'collector',
          `${environment}-scan.json`,
        );
      if (stage.endsWith('.capture')) {
        const environment = env as Environment;
        const supervisor = new BrowserSupervisor();
        let scan: ScanResult;
        try {
          scan = await supervisor.run(() =>
            new PlaywrightCollector(evidence).collect(runId, page, environment),
          );
        } finally {
          const manifest = await store.load(runId);
          manifest.browserRestartCount =
            (manifest.browserRestartCount ?? 0) + supervisor.restartCount;
          await store.save(manifest);
        }
        const path = await evidence.save(
          {
            runId,
            pageId: page.id,
            environment,
            kind: 'scan_json',
            path: `${environment}-scan.json`,
            createdAt: new Date().toISOString(),
          },
          JSON.stringify(scan, null, 2),
        );
        await store.set(
          runId,
          page.id,
          env,
          stage,
          scan.navigationError ? 'INCONCLUSIVE_ENVIRONMENT' : 'COMPLETED',
          { evidencePath: path, note: scan.navigationError },
        );
        return;
      }
      if (stage.endsWith('.links.probe')) {
        const environment = env as Environment;
        const scan = JSON.parse(await readFile(scanPath(environment), 'utf8')) as ScanResult;
        const checks = await new ReadOnlyLinkProber(environment === 'production' ? 3 : 5, 0).probe(
          scan,
          page,
          scan.linkChecks,
          async (value) => {
            await evidence.save(
              {
                runId,
                pageId: page.id,
                environment,
                kind: 'scan_json',
                path: `${environment}-link-checkpoint.json`,
                createdAt: new Date().toISOString(),
              },
              JSON.stringify(value),
            );
          },
        );
        scan.linkChecks = checks;
        const path = await evidence.save(
          {
            runId,
            pageId: page.id,
            environment,
            kind: 'scan_json',
            path: `${environment}-scan.json`,
            createdAt: new Date().toISOString(),
          },
          JSON.stringify(scan, null, 2),
        );
        await store.set(
          runId,
          page.id,
          env,
          stage,
          checks.some((check) => check.outcome === 'INCONCLUSIVE')
            ? 'INCONCLUSIVE_ENVIRONMENT'
            : 'COMPLETED',
          { evidencePath: path },
        );
        return;
      }
      if (stage.endsWith('.rules.evaluate')) {
        const environment = env as Environment;
        const scan = JSON.parse(await readFile(scanPath(environment), 'utf8')) as ScanResult;
        const result = evaluateRules(page, scan, rules);
        const path = await evidence.save(
          {
            runId,
            pageId: page.id,
            environment,
            kind: 'scan_json',
            path: `${environment}-rule-results.json`,
            createdAt: new Date().toISOString(),
          },
          JSON.stringify(result, null, 2),
        );
        await store.set(
          runId,
          page.id,
          env,
          stage,
          result.some((item) => item.verdict === 'FAIL') ? 'FAILED_QUALITY' : 'COMPLETED',
          { evidencePath: path },
        );
        return;
      }
      if (stage.includes('compare')) {
        const scans = await Promise.all(
          (['template', 'production', 'ote'] as Environment[]).map(
            async (environment) =>
              JSON.parse(await readFile(scanPath(environment), 'utf8')) as ScanResult,
          ),
        );
        const [template, production, ote] = scans;
        const result = comparisonResults(
          template.model,
          ote.model,
          production.model,
          page.severity,
          template.screenshotPath,
          Object.values(page.urls),
        );
        const path = await evidence.save(
          {
            runId,
            pageId: page.id,
            kind: 'scan_json',
            path: 'comparison-results.json',
            createdAt: new Date().toISOString(),
          },
          JSON.stringify(result, null, 2),
        );
        await store.set(
          runId,
          page.id,
          'batch',
          stage,
          result.some((item) => item.verdict === 'FAIL') ? 'FAILED_QUALITY' : 'COMPLETED',
          { evidencePath: path },
        );
        return;
      }
      await store.set(runId, page.id, 'batch', stage, 'COMPLETED');
    } catch (error) {
      await store.set(runId, page.id, env, stage, 'INCONCLUSIVE_ENVIRONMENT', {
        note: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
