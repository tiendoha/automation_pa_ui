import { isTerminal, type DailyRunStatus, type StageStatus } from '../evidence/run-manifest.js';
const transitions: Record<StageStatus, StageStatus[]> = {
  PENDING: ['RUNNING', 'SKIPPED_UNSAFE', 'INCONCLUSIVE_ENVIRONMENT'],
  RUNNING: [
    'CHECKPOINTED',
    'RETRYING',
    'COMPLETED',
    'FAILED_QUALITY',
    'INCONCLUSIVE_ENVIRONMENT',
    'SKIPPED_UNSAFE',
  ],
  CHECKPOINTED: ['RUNNING', 'RETRYING', 'INCONCLUSIVE_ENVIRONMENT'],
  RETRYING: ['RUNNING', 'CHECKPOINTED', 'INCONCLUSIVE_ENVIRONMENT'],
  COMPLETED: [],
  FAILED_QUALITY: [],
  INCONCLUSIVE_ENVIRONMENT: [],
  SKIPPED_UNSAFE: [],
  INTERRUPTED_RESUMABLE: ['CHECKPOINTED', 'RUNNING'],
};
export function assertStageTransition(from: StageStatus, to: StageStatus): void {
  if (!transitions[from].includes(to))
    throw new Error(`Invalid stage transition: ${from} -> ${to}`);
}
export const stageTerminal = (status: StageStatus | undefined): boolean => isTerminal(status);
export function dailyVerdict(statuses: StageStatus[]): DailyRunStatus {
  if (!statuses.every(isTerminal))
    throw new Error('Cannot finalize a daily run with non-terminal stages.');
  return statuses.some((s) => s === 'INCONCLUSIVE_ENVIRONMENT')
    ? 'COMPLETED_WITH_INCONCLUSIVE'
    : 'COMPLETED';
}
