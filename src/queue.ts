import { sleep } from './sleep';

export interface QueueOptions {
  parallel: number;
  retries: number;
  delay: number;
  backoff: boolean;
}

export interface ScheduleOptions {
  retries: number;
  delay: number;
  backoff: boolean;
  priority: number;
}

export type QueueEntry<T> = {
  action(options: ScheduleOptions): T;
  resolve(value?: T | PromiseLike<T> | undefined): void;
  reject(reason?: any): void;
} & ScheduleOptions;

export class Queue {
  untilEmpty?: Promise<void>;

  private resolveUntilEmpty?: () => void;

  private queue: QueueEntry<any>[] = [];

  private workers = 0;

  private lock = 0;

  private options: QueueOptions;

  constructor({
    parallel = 1,
    retries = 0,
    delay = 0,
    backoff = false,
  }: Partial<QueueOptions> = {}) {
    this.options = { parallel, retries, delay, backoff };
  }

  private checkUntilEmpty() {
    if (!this.resolveUntilEmpty && this.size > 0) {
      this.untilEmpty = new Promise((resolve) => {
        this.resolveUntilEmpty = resolve;
      });
    } else if (this.resolveUntilEmpty && this.size === 0) {
      this.resolveUntilEmpty();
      delete this.untilEmpty;
      delete this.resolveUntilEmpty;
    }
  }

  schedule<T>(
    action: (options: ScheduleOptions) => T | PromiseLike<T>,
    {
      retries = this.options.retries,
      delay = this.options.delay,
      backoff = this.options.backoff,
      priority = Number.POSITIVE_INFINITY,
    }: Partial<ScheduleOptions> = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry = { action, resolve, reject, retries, delay, backoff, priority };
      if (priority === Number.POSITIVE_INFINITY) this.queue.push(entry);
      else {
        const index = this.queue.findIndex((entry) => entry.priority > priority);
        if (index >= 0) this.queue.splice(index, 0, entry);
        else this.queue.push(entry);
      }

      this.checkUntilEmpty();
      this._startWorker();
    });
  }

  private async _startWorker() {
    if (this.workers < this.options.parallel) {
      this.workers++;
      setTimeout(() => this._worker());
    }
  }

  private async _worker(start = new Date()) {
    if (this.queue.length === 0) {
      this.workers--;
      return;
    }

    this.lock++;
    const { action, resolve, reject, backoff, priority, ...item } =
      this.queue.shift() as QueueEntry<any>;
    let { retries, delay } = item;

    try {
      for (;;) {
        try {
          let result = action({ retries, delay, backoff, priority });
          if (result instanceof Promise) result = await result;
          resolve(result);
          break;
        } catch (error) {
          if (retries > 0) {
            await sleep(delay);
            retries--;
            if (backoff) delay *= 2;
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      reject(error);
    } finally {
      this.lock--;
      if (Date.now() - Number(start) < 10) this._worker(start);
      else setTimeout(() => this._worker());
      this.checkUntilEmpty();
    }
  }

  get size(): number {
    return this.queue.length + this.lock;
  }

  clear(resolve?: unknown): void {
    for (const item of this.queue) {
      if (resolve !== undefined) item.resolve(resolve);
      else item.reject(Object.assign(new Error('Canceled'), { canceled: true }));
    }
    this.queue = [];
    this.checkUntilEmpty();
  }

  async replace<T>(
    action: (options: ScheduleOptions) => T,
    {
      retries = this.options.retries,
      delay = this.options.delay,
      backoff = this.options.backoff,
      priority = Number.POSITIVE_INFINITY,
    }: Partial<ScheduleOptions> = {},
  ): Promise<T> {
    const queue = this.queue;
    this.queue = [];
    const result = await this.schedule(action, { retries, delay, backoff, priority });
    for (const item of queue) item.resolve(result);
    return result;
  }
}
