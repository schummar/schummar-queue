import { Callable } from './callable';
import isPromise from './isPromise';
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

export class Queue extends Callable<any> {
  static create(options?: Partial<QueueOptions>): Queue {
    return new Queue(options);
  }

  private completionListeners: Array<() => void> = [];

  private queue: QueueEntry<any>[] = [];

  private workers = 0;

  private options: QueueOptions;

  private constructor({
    parallel = 1,
    retries = 0,
    delay = 0,
    backoff = false,
  }: Partial<QueueOptions> = {}) {
    super((action: any, options?: any) => this.schedule(action, options));
    this.options = { parallel, retries, delay, backoff };
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

      this._worker();
    });
  }

  private async _worker(start = new Date()) {
    if (this.workers >= this.options.parallel) {
      return;
    }

    this.workers++;

    let next;
    while ((next = this.queue.shift())) {
      const { action, resolve, reject, backoff, priority } = next;
      let { retries, delay } = next;

      retryLoop: for (;;) {
        try {
          let result = action({ retries, delay, backoff, priority });
          if (isPromise(result)) result = await result;
          resolve(result);
          break retryLoop;
        } catch (error) {
          if (retries <= 0) {
            reject(error);
            break retryLoop;
          }

          if (delay > 0) {
            await sleep(delay);
          }

          retries--;
          if (backoff) {
            delay *= 2;
          }
        }
      }

      if (Date.now() - Number(start) < 10) {
        this._worker(start);
      } else setTimeout(() => this._worker());
    }

    this.workers--;
    this._notify();
  }

  private _notify() {
    if (this.size === 0) {
      for (const listener of this.completionListeners) {
        listener();
      }

      this.completionListeners = [];
    }
  }

  get size(): number {
    return this.queue.length + this.workers;
  }

  clear(resolve?: unknown): void {
    for (const item of this.queue) {
      if (resolve !== undefined) item.resolve(resolve);
      else item.reject(Object.assign(new Error('Canceled'), { canceled: true }));
    }
    this.queue = [];
    this._notify();
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

  whenEmpty(): Promise<void> {
    return new Promise((resolve) => {
      if (this.size === 0) {
        resolve();
      } else {
        this.completionListeners.push(resolve);
      }
    });
  }
}

export function createQueue(options?: Partial<QueueOptions>): Queue & Queue['schedule'] {
  return Queue.create(options) as Queue & Queue['schedule'];
}
