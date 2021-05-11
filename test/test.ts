import test from 'ava';
import { Queue } from '../src';
import { sleep } from '../src/sleep';

test('queue', async (t) => {
  t.plan(20);

  const queue = new Queue({ parallel: 5 });

  let running = 0;

  for (let i = 0; i < 10; i++) {
    queue
      .schedule(
        async () => {
          running++;
          t.is(running, (i % 5) + 1, `i=${i} ${running}`);
          await sleep(10);
          running--;
          return i;
        }
        // { priority: i === 9 ? 0 : 1 }
      )
      .then((result) => t.is(result, i));
  }

  await queue.last;
});
