export interface BrowserSupervisorOptions {
  restartLimitPerStage?: number;
  stageTimeoutMs?: number;
}
/** Bounds browser work; each retry calls the collector afresh, thus using a new browser/context. */
export class BrowserSupervisor {
  readonly restartLimit: number;
  readonly stageTimeoutMs: number;
  restartCount = 0;
  constructor(options: BrowserSupervisorOptions = {}) {
    this.restartLimit = options.restartLimitPerStage ?? 3;
    this.stageTimeoutMs = options.stageTimeoutMs ?? 90_000;
  }
  async run<T>(work: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt <= this.restartLimit; attempt += 1)
      try {
        return await Promise.race([
          work(),
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('BROWSER_STAGE_TIMEOUT')), this.stageTimeoutMs),
          ),
        ]);
      } catch (error) {
        last = error;
        this.restartCount += 1;
      }
    throw last;
  }
}
