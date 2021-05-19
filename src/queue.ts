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

  constructor(options: Partial<QueueOptions> = {}) {
    this.options = {
      parallel: 1,
      retries: 0,
      delay: 0,
      backoff: false,
      ...options,
    };
  }

  private checkUntilEmpty() {
    if (!this.resolveUntilEmpty && this.size > 0) {
      this.untilEmpty = new Promise((r) => (this.resolveUntilEmpty = r));
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
      priority = Infinity,
    }: Partial<ScheduleOptions> = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry = { action, resolve, reject, retries, delay, backoff, priority };
      if (priority === Infinity) this.queue.push(entry);
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
      setImmediate(() => this._worker());
    }
  }

  private async _worker(start = new Date()) {
    if (this.queue.length === 0) {
      this.workers--;
      return;
    }

    this.lock++;
    const { action, resolve, reject, backoff, priority, ...item } = this.queue.shift() as QueueEntry<any>;
    let { retries, delay } = item;

    try {
      for (;;) {
        try {
          let result = action({ retries, delay, backoff, priority });
          if (result instanceof Promise) result = await result;
          resolve(result);
          break;
        } catch (e) {
          if (retries > 0) {
            await sleep(delay);
            retries--;
            if (backoff) delay *= 2;
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      reject(e);
    } finally {
      this.lock--;
      if (Number(new Date()) - Number(start) < 10) this._worker(start);
      else setImmediate(() => this._worker());
      this.checkUntilEmpty();
    }
  }

  get size(): number {
    return this.queue.length + this.lock;
  }

  clear(resolve?: unknown): void {
    for (const item of this.queue) {
      if (resolve !== undefined) item.resolve(resolve);
      else item.reject(Object.assign(Error('Canceled'), { canceled: true }));
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
      priority = Infinity,
    }: Partial<ScheduleOptions> = {}
  ): Promise<T> {
    const queue = this.queue;
    this.queue = [];
    const result = await this.schedule(action, { retries, delay, backoff, priority });
    for (const item of queue) item.resolve(result);
    return result;
  }
}
