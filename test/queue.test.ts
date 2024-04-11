import { expect, test } from 'vitest';
import { createQueue } from '../src';
import { sleep } from '../src/sleep';

test('queue', async () => {
  const queue = createQueue({ parallel: 5 });

  let done = 0;
  let running = 0;

  for (let i = 0; i < 10; i++) {
    queue(
      // eslint-disable-next-line no-loop-func
      async () => {
        running++;
        expect(running).lessThanOrEqual(5);
        await sleep(10);
        running--;
        done++;
        return i;
      },
      { priority: i === 9 ? 0 : 1 },
    )
      .then((result) => expect(result).toBe(i))
      .catch(() => undefined);
  }

  await queue.whenEmpty();
  expect(done).toBe(10);
});
