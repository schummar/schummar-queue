import { Queue, createQueue, type QueueOptions } from './queue';

export function queued<Args extends any[], T>(
  ...args:
    | [fn: (...args: Args) => T | PromiseLike<T>]
    | [queue: Queue | Partial<QueueOptions>, fn: (...args: Args) => T | PromiseLike<T>]
): ((...argument: Args) => Promise<T>) & { qeueue: Queue } {
  const [qArgument, function_] = args.length === 2 ? args : [undefined, ...args];
  const q = qArgument instanceof Queue ? qArgument : createQueue(qArgument);
  const function__ = (...args: Args) => q.schedule(() => function_(...args));
  return Object.assign(function__, { qeueue: q });
}
