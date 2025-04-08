import { Queue, createQueue, type QueueOptions } from './queue';

export function queued<Fn extends (...arg: any[]) => any>(
  ...args: [fn: Fn] | [queue: Queue | Partial<QueueOptions>, fn: Fn]
): ((...argument: Parameters<Fn>) => Promise<Awaited<ReturnType<Fn>>>) & {
  qeueue: Queue;
  executeDirectly: Fn;
} {
  const [qArgument, function_] = args.length === 2 ? args : [undefined, ...args];
  const q = qArgument instanceof Queue ? qArgument : createQueue(qArgument);

  const function__ = (...args: Parameters<Fn>) => q.schedule(() => function_(...args));

  return Object.assign(function__, {
    qeueue: q,
    executeDirectly: function_,
  });
}
