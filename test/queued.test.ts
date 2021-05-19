import test from 'ava';
import { Queue, queued } from '../src';
import { sleep } from '../src/sleep';

test('queued', async (t) => {
  t.plan(20);

  let running = 0;

  const fn = queued(async (x: string) => {
    running++;
    t.assert(running === 1);
    await sleep(10);
    running--;
    return Number(x);
  });
  for (let i = 0; i < 10; i++) fn(String(i)).then((v) => t.is(v, i));
  await fn.qeueue.untilEmpty;
});

test('queued with options', async (t) => {
  t.plan(20);

  let running = 0;

  const fn = queued({ parallel: 2 }, async (x: string) => {
    running++;
    t.assert(running <= 2);
    await sleep(10);
    running--;
    return Number(x);
  });
  for (let i = 0; i < 10; i++) fn(String(i)).then((v) => t.is(v, i));
  await fn.qeueue.untilEmpty;
});

test('queued two', async (t) => {
  t.plan(20);

  let running = 0;
  const q = new Queue();

  const fn1 = queued(q, async (x: string) => {
    running++;
    t.assert(running === 1);
    await sleep(10);
    running--;
    return Number(x);
  });
  const fn2 = queued(q, async (x: string) => {
    running++;
    t.assert(running === 1);
    await sleep(10);
    running--;
    return Number(x);
  });
  for (let i = 0; i < 5; i++) {
    fn1(String(i)).then((v) => t.is(v, i));
    fn2(String(i)).then((v) => t.is(v, i));
  }

  await q.untilEmpty;
});
