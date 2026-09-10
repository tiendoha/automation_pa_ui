export interface QueuedTask {
  pageId: string;
  stage: string;
}
/** Fair FIFO queue: a retry moves behind unrelated page work. */
export class TaskQueue {
  private readonly pending: QueuedTask[];
  constructor(tasks: QueuedTask[]) {
    this.pending = [...tasks];
  }
  take(): QueuedTask | undefined {
    return this.pending.shift();
  }
  retry(task: QueuedTask): void {
    this.pending.push(task);
  }
  get size(): number {
    return this.pending.length;
  }
}
