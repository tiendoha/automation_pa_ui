import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isTerminal, type RunManifest } from '../evidence/run-manifest.js';

const csv = (value: unknown): string => `"${String(value ?? '').replaceAll('"', '""')}"`;
export function allStagesTerminal(manifest: RunManifest): boolean {
  const records = Object.values(manifest.stages ?? {}).flatMap(Object.values);
  return records.length > 0 && records.every((record) => isTerminal(record.status));
}
export async function publishDailyReport(
  root: string,
  manifest: RunManifest,
): Promise<{ reportPath: string; metricsPath: string }> {
  if (!allStagesTerminal(manifest))
    throw new Error('Final report cannot be published while a stage is non-terminal.');
  const directory = join(root, manifest.runId);
  await mkdir(directory, { recursive: true });
  const rows = Object.entries(manifest.stages ?? {}).flatMap(([pageId, stages]) =>
    Object.entries(stages).map(([stage, record]) => ({ pageId, stage, ...record })),
  );
  const inconclusive = rows.filter((row) => row.status === 'INCONCLUSIVE_ENVIRONMENT').length;
  const body = [
    `# Daily monitoring report`,
    '',
    `- Run: ${manifest.runId}`,
    `- Business date: ${manifest.businessDate ?? 'unknown'} (${manifest.timezone ?? 'Asia/Ho_Chi_Minh'})`,
    `- Status: ${manifest.status}`,
    `- Pages: ${Object.keys(manifest.pages).length}`,
    `- Stages: ${rows.length}; inconclusive: ${inconclusive}`,
    `- Browser restarts: ${manifest.browserRestartCount ?? 0}; process resumes: ${manifest.processResumeCount ?? 0}`,
    '',
    '| Page | Stage | Status | Attempts | Evidence |',
    '| --- | --- | --- | ---: | --- |',
    ...rows.map(
      (row) =>
        `| ${row.pageId} | ${row.stage} | ${row.status} | ${row.attempts} | ${row.evidencePath ?? ''} |`,
    ),
    '',
  ].join('\n');
  const metrics = [
    'daily_run_id,business_date,page_id,environment,stage,status,attempt_count,browser_restart_count,process_resume_count,started_at,ended_at,elapsed_seconds,pass_count,fail_count,inconclusive_count,unsafe_skipped_count,evidence_path,note',
    ...rows.map((row) =>
      [
        manifest.runId,
        manifest.businessDate,
        row.pageId,
        row.stage.split('.')[0],
        row.stage,
        row.status,
        row.attempts,
        manifest.browserRestartCount ?? 0,
        manifest.processResumeCount ?? 0,
        row.startedAt,
        row.endedAt,
        '',
        '',
        '',
        row.status === 'INCONCLUSIVE_ENVIRONMENT' ? 1 : 0,
        row.status === 'SKIPPED_UNSAFE' ? 1 : 0,
        row.evidencePath,
        row.note,
      ]
        .map(csv)
        .join(','),
    ),
  ].join('\n');
  for (const [name, content] of [
    ['report.final.md', body],
    ['metrics.csv', metrics],
  ] as const) {
    const temporary = join(directory, `.${name}.tmp`);
    await writeFile(temporary, content);
    await rename(temporary, join(directory, name));
  }
  return {
    reportPath: join(directory, 'report.final.md'),
    metricsPath: join(directory, 'metrics.csv'),
  };
}
