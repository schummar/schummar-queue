import { Queue, QueueOptions } from './queue';

export function queued<Args extends any[], T>(
  ...args: [fn: (...args: Args) => T | PromiseLike<T>] | [queue: Queue | Partial<QueueOptions>, fn: (...args: Args) => T | PromiseLike<T>]
): ((...arg: Args) => Promise<T>) & { qeueue: Queue } {
  const [qArg, fn] = args.length === 2 ? args : [undefined, ...args];
  const q = qArg instanceof Queue ? qArg : new Queue(qArg);
  const fn_ = (...args: Args) => q.schedule(() => fn(...args));
  return Object.assign(fn_, { qeueue: q });
}
