import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Environment } from '../domain/models.js';

export const terminalStageStatuses = ['COMPLETED', 'FAILED_QUALITY', 'INCONCLUSIVE_ENVIRONMENT', 'SKIPPED_UNSAFE'] as const;
export type TerminalStageStatus = (typeof terminalStageStatuses)[number];
export type StageStatus = 'PENDING' | 'RUNNING' | 'CHECKPOINTED' | 'RETRYING' | TerminalStageStatus | 'INTERRUPTED_RESUMABLE';
export type LiveStage = 'scan' | 'comparison' | 'batch' | 'template.reference.capture' | 'production.browser.capture' | 'production.links.probe' | 'production.rules.evaluate' | 'ote.browser.capture' | 'ote.links.probe' | 'ote.rules.evaluate' | 'template.target.compare' | 'ote.production.compare' | 'page.aggregate';
export type DailyRunStatus = 'PENDING' | 'RUNNING' | 'RECOVERING' | 'FINALIZING' | 'COMPLETED' | 'COMPLETED_WITH_INCONCLUSIVE' | 'FATAL';
export interface StageRecord { status: StageStatus; startedAt?: string; endedAt?: string; attempts: number; evidencePath?: string; note?: string; }
export interface RunManifest {
  runId: string; dailyRunId?: string; businessDate?: string; timezone?: string; status?: DailyRunStatus;
  configHash?: string; ruleHash?: string; registryPageIds?: string[]; browserRestartCount?: number; processResumeCount?: number;
  publicationState?: 'PENDING' | 'PUBLISHED'; pages: Record<string, Partial<Record<Environment | 'batch', Partial<Record<LiveStage, StageStatus>>>>>;
  stages?: Record<string, Record<string, StageRecord>>; updatedAt: string; completedAt?: string;
}
export const isTerminal = (status: StageStatus | undefined): boolean => status !== undefined && (terminalStageStatuses as readonly string[]).includes(status);

/** Crash-safe checkpoint store; `manifest.previous.json` is retained for recovery. */
export class RunManifestStore {
  constructor(private readonly root: string) {}
  private dir(runId: string): string { return join(this.root, runId); }
  private path(runId: string): string { return join(this.dir(runId), 'manifest.json'); }
  private legacyPath(runId: string): string { return join(this.dir(runId), 'run-manifest.json'); }
  private previousPath(runId: string): string { return join(this.dir(runId), 'manifest.previous.json'); }
  async load(runId: string): Promise<RunManifest> {
    for (const path of [this.path(runId), this.previousPath(runId), this.legacyPath(runId)]) {
      try { return JSON.parse(await readFile(path, 'utf8')) as RunManifest; }
      catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') continue; }
    }
    return { runId, pages: {}, stages: {}, updatedAt: new Date().toISOString() };
  }
  async save(manifest: RunManifest): Promise<RunManifest> {
    const dir = this.dir(manifest.runId); await mkdir(dir, { recursive: true }); manifest.updatedAt = new Date().toISOString();
    try { await rename(this.path(manifest.runId), this.previousPath(manifest.runId)); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const temporary = join(dir, `.manifest-${process.pid}-${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(manifest, null, 2)); await rename(temporary, this.path(manifest.runId)); return manifest;
  }
  async set(runId: string, pageId: string, environment: Environment | 'batch', stage: LiveStage, status: StageStatus, detail: Partial<StageRecord> = {}): Promise<RunManifest> {
    const manifest = await this.load(runId); manifest.pages[pageId] ??= {}; manifest.pages[pageId][environment] ??= {}; manifest.pages[pageId][environment][stage] = status;
    manifest.stages ??= {}; manifest.stages[pageId] ??= {}; const prior = manifest.stages[pageId][stage];
    manifest.stages[pageId][stage] = { status, attempts: detail.attempts ?? (prior?.attempts ?? 0) + (status === 'RUNNING' ? 1 : 0), startedAt: detail.startedAt ?? prior?.startedAt ?? (status === 'RUNNING' ? new Date().toISOString() : undefined), endedAt: detail.endedAt ?? (isTerminal(status) ? new Date().toISOString() : prior?.endedAt), evidencePath: detail.evidencePath ?? prior?.evidencePath, note: detail.note ?? prior?.note };
    return this.save(manifest);
  }
  async checkpointRunning(runId: string): Promise<RunManifest> {
    const manifest = await this.load(runId);
    for (const [pageId, records] of Object.entries(manifest.stages ?? {})) for (const [stage, record] of Object.entries(records)) if (['RUNNING', 'RETRYING', 'INTERRUPTED_RESUMABLE'].includes(record.status)) {
      record.status = 'CHECKPOINTED'; const env = stage.startsWith('template.') ? 'template' : stage.startsWith('production.') ? 'production' : stage.startsWith('ote.') ? 'ote' : 'batch';
      manifest.pages[pageId] ??= {}; manifest.pages[pageId][env] ??= {}; manifest.pages[pageId][env][stage as LiveStage] = 'CHECKPOINTED';
    }
    manifest.status = 'RECOVERING'; manifest.processResumeCount = (manifest.processResumeCount ?? 0) + 1; return this.save(manifest);
  }
}
