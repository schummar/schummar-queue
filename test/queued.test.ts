import { expect, test } from 'vitest';
import { createQueue, queued } from '../src';
import { sleep } from '../src/sleep';

test('queued', async () => {
  let running = 0;

  const function_ = queued(async (x: string) => {
    running++;
    expect(running).toBe(1);
    await sleep(10);
    running--;
    return Number(x);
  });
  for (let i = 0; i < 10; i++)
    function_(String(i))
      .then((v) => expect(v).toBe(i))
      .catch(() => undefined);

  await function_.qeueue.whenEmpty();
});

test('queued with options', async () => {
  let running = 0;

  const function_ = queued({ parallel: 2 }, async (x: string) => {
    running++;
    expect(running).toBeLessThanOrEqual(2);
    await sleep(10);
    running--;
    return Number(x);
  });
  for (let i = 0; i < 10; i++)
    function_(String(i))
      .then((v) => expect(v).toBe(i))
      .catch(() => undefined);

  await function_.qeueue.whenEmpty();
});

test('queued two', async () => {
  let running = 0;
  const q = createQueue();

  const function1 = queued(q, async (x: string) => {
    running++;
    expect(running).toBe(1);
    await sleep(10);
    running--;
    return Number(x);
  });

  const function2 = queued(q, async (x: string) => {
    running++;
    expect(running).toBe(1);
    await sleep(10);
    running--;
    return Number(x);
  });

  for (let i = 0; i < 5; i++) {
    function1(String(i))
      .then((v) => expect(v).toBe(i))
      .catch(() => undefined);

    function2(String(i))
      .then((v) => expect(v).toBe(i))
      .catch(() => undefined);
  }

  await q.whenEmpty();
});
