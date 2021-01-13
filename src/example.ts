import { Queue } from './queue';
import { sleep } from './sleep';

const queue = new Queue({ parallel: 5 });

for (let i = 0; i < 10; i++) {
  queue
    .schedule(
      async () => {
        console.debug('Start', i);
        await sleep(500);
        console.debug('Done', i);
        return i;
      },
      { priority: i === 9 ? 0 : 1 }
    )
    .then((i) => console.log('Resolved promise', i));
}
