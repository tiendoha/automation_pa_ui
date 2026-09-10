import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadPage, loadRules } from '../config/loaders.js';
import { FileEvidenceStore } from '../evidence/file-store.js';
import { RunManifestStore } from '../evidence/run-manifest.js';
import { log } from '../logging/logger.js';
import { evaluateRules } from '../rules/engine/engine.js';
import { PlaywrightCollector } from '../scanner/collector.js';
import { comparisonResults } from '../normalization/comparator.js';
import type { Environment, ScanResult } from '../domain/models.js';
import { DailyRunner, dailyRunId } from '../orchestration/daily-runner.js';
import { publishDailyReport } from '../reporting/daily-report.js';

const arg = (name: string): string | undefined => {
  // npm/tsx wrappers may forward an earlier copy of an option; the user supplied
  // value is the final occurrence.
  const index = process.argv.lastIndexOf(name);
  return index === -1 ? undefined : process.argv.at(index + 1);
};
async function scan(): Promise<void> {
  const pageId = arg('--page');
  if (!pageId)
    throw new Error(
      'Usage: scan --page <page-id[,page-id]> [--environment <template|ote|production>]',
    );
  const selectedEnvironment = arg('--environment') as Environment | undefined;
  const stage = arg('--stage');
  const requestedRunId = arg('--run-id');
  const resume = process.argv.includes('--resume');
  const timeBudgetMinutes = arg('--time-budget-minutes');
  const timeBudgetMs =
    timeBudgetMinutes === undefined ? undefined : Number(timeBudgetMinutes) * 60_000;
  if (timeBudgetMs !== undefined && (!Number.isFinite(timeBudgetMs) || timeBudgetMs <= 0))
    throw new Error('--time-budget-minutes must be a positive number.');
  if (stage && stage !== 'comparison') throw new Error('Supported --stage value: comparison');
  if (stage === 'comparison' && selectedEnvironment)
    throw new Error('--stage comparison cannot be combined with --environment.');
  const environments: Environment[] = selectedEnvironment
    ? [selectedEnvironment]
    : ['template', 'production', 'ote'];
  for (const id of pageId.split(',')) {
    const page = await loadPage(resolve('config/pages', `${id}.yaml`));
    const runId = requestedRunId ?? randomUUID();
    const evidence = new FileEvidenceStore(process.env.EVIDENCE_ROOT ?? './evidence');
    const manifest = new RunManifestStore(process.env.EVIDENCE_ROOT ?? './evidence');
    const rules = await loadRules(resolve('config/rules/pilot-rules.yaml'));
    const scans = new Map<Environment, ScanResult>();
    const results = [];
    const evidenceRoot = process.env.EVIDENCE_ROOT ?? './evidence';
    if (stage === 'comparison') {
      await manifest.set(runId, page.id, 'batch', 'comparison', 'RUNNING');
      for (const environment of ['template', 'ote', 'production'] as Environment[]) {
        const path = join(
          evidenceRoot,
          runId,
          page.id,
          environment,
          environment === 'template' ? 'reference' : 'target',
          'collector',
          `${environment}-scan.json`,
        );
        scans.set(environment, JSON.parse(await readFile(path, 'utf8')) as ScanResult);
      }
      results.push(
        ...comparisonResults(
          scans.get('template')!.model,
          scans.get('ote')!.model,
          scans.get('production')!.model,
          page.severity,
          scans.get('template')!.screenshotPath,
          Object.values(page.urls),
        ),
      );
      const resultEvidencePath = await evidence.save(
        {
          runId,
          pageId: page.id,
          kind: 'scan_json',
          path: 'comparison-results.json',
          createdAt: new Date().toISOString(),
        },
        JSON.stringify(results, null, 2),
      );
      log('comparison.completed', { runId, pageId: page.id, resultEvidencePath, results });
      await manifest.set(runId, page.id, 'batch', 'comparison', 'COMPLETED');
      continue;
    }
    for (const environment of environments) {
      const scanPath = join(
        evidenceRoot,
        runId,
        page.id,
        environment,
        environment === 'template' ? 'reference' : 'target',
        'collector',
        `${environment}-scan.json`,
      );
      let resumeLinkChecks: ScanResult['linkChecks'] = [];
      if (resume && environment !== 'template') {
        try {
          resumeLinkChecks = (JSON.parse(await readFile(scanPath, 'utf8')) as ScanResult)
            .linkChecks;
        } catch (error: unknown) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      await manifest.set(runId, page.id, environment, 'scan', 'RUNNING');
      const collector = new PlaywrightCollector(evidence, {
        timeBudgetMs,
        resumeLinkChecks,
        onLinkCheckpoint: async (linkChecks) => {
          await evidence.save(
            {
              runId,
              pageId: page.id,
              environment,
              kind: 'scan_json',
              path: `${environment}-link-checkpoint.json`,
              createdAt: new Date().toISOString(),
            },
            JSON.stringify(linkChecks, null, 2),
          );
        },
      });
      const existingStatus = (await manifest.load(runId)).pages[page.id]?.[environment]?.scan;
      if (resume && existingStatus === 'COMPLETED') {
        log('scan.resume_skipped_completed', { runId, pageId: page.id, environment });
        continue;
      }
      const result = await collector.collect(runId, page, environment);
      scans.set(environment, result);
      const evidencePath = await evidence.save(
        {
          runId,
          pageId: page.id,
          environment,
          kind: 'scan_json',
          path: `${environment}-scan.json`,
          createdAt: new Date().toISOString(),
        },
        JSON.stringify(result, null, 2),
      );
      results.push(
        ...evaluateRules(page, result, rules).map((rule) => ({
          ...rule,
          evidenceReference: rule.evidenceReference ?? evidencePath,
          environment,
        })),
      );
      await evidence.save(
        {
          runId,
          pageId: page.id,
          environment,
          kind: 'scan_json',
          path: `${environment}-rule-results.json`,
          createdAt: new Date().toISOString(),
        },
        JSON.stringify(
          results.filter((result) => result.environment === environment),
          null,
          2,
        ),
      );
      await manifest.set(
        runId,
        page.id,
        environment,
        'scan',
        result.interrupted ? 'INTERRUPTED_RESUMABLE' : 'COMPLETED',
      );
      if (result.interrupted) {
        log('scan.interrupted_resumable', { runId, pageId: page.id, environment, evidencePath });
        continue;
      }
    }
    if (
      !selectedEnvironment &&
      scans.has('template') &&
      scans.has('ote') &&
      scans.has('production')
    ) {
      results.push(
        ...comparisonResults(
          scans.get('template')!.model,
          scans.get('ote')!.model,
          scans.get('production')!.model,
          page.severity,
          scans.get('ote')!.screenshotPath,
          Object.values(page.urls),
        ),
      );
    }
    const resultEvidencePath = await evidence.save(
      {
        runId,
        pageId: page.id,
        kind: 'scan_json',
        path: 'rule-results.json',
        createdAt: new Date().toISOString(),
      },
      JSON.stringify(results, null, 2),
    );
    log('scan.completed', { runId, pageId: page.id, environments, resultEvidencePath, results });
  }
}
async function cleanup(): Promise<void> {
  const days = Number(arg('--days') ?? '30');
  if (!Number.isInteger(days) || days < 30)
    throw new Error('Cleanup retention must be an integer of at least 30 days.');
  log('evidence.cleaned', {
    removed: await new FileEvidenceStore(
      process.env.EVIDENCE_ROOT ?? './evidence',
    ).cleanupOlderThan(days),
  });
}
const dateArg = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error('--date must be YYYY-MM-DD');
  return new Date(`${value}T12:00:00+07:00`);
};
async function monitorDaily(): Promise<void> {
  const pages = arg('--pages')?.split(',').filter(Boolean);
  const manifest = await new DailyRunner().run({
    date: dateArg(arg('--date')),
    pages,
    forceNew: process.argv.includes('--force-new'),
  });
  log('daily.completed', { runId: manifest.runId, status: manifest.status });
}
async function monitorStatus(): Promise<void> {
  const runId = arg('--run-id') ?? dailyRunId();
  log('daily.status', { manifest: await new DailyRunner().status(runId) });
}
async function monitorReport(): Promise<void> {
  const runId = arg('--run-id') ?? dailyRunId();
  const runner = new DailyRunner();
  const manifest = await runner.status(runId);
  await publishDailyReport(process.env.EVIDENCE_ROOT ?? './evidence', manifest);
  log('daily.report_published', { runId });
}
const command = process.argv[2];
if (command === 'scan') await scan();
else if (command === 'cleanup') await cleanup();
else if (command === 'monitor:daily') await monitorDaily();
else if (command === 'monitor:status') await monitorStatus();
else if (command === 'monitor:report') await monitorReport();
else throw new Error('Commands: scan, cleanup, monitor:daily, monitor:status, monitor:report');
