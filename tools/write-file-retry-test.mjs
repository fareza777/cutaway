import assert from 'node:assert/strict';

import { writeFileWithRetry } from './lib/write-file-retry.mjs';

let failures = 0;

function check(label, action) {
  try {
    action();
    console.log(`✓ ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${label}: ${error.message}`);
  }
}

function fileError(code) {
  return Object.assign(new Error(`fixture ${code}`), { code });
}

check('retries a transient Windows file lock and preserves the payload', () => {
  const payload = Buffer.from('deterministic model bytes');
  const waits = [];
  const writes = [];

  writeFileWithRetry('fixture.glb', payload, {
    retryDelaysMs: [25, 75, 150],
    wait: (milliseconds) => waits.push(milliseconds),
    writeFile: (file, bytes) => {
      writes.push({ file, bytes });
      if (writes.length < 3) throw fileError('UNKNOWN');
    },
  });

  assert.equal(writes.length, 3);
  assert.deepEqual(waits, [25, 75]);
  assert.ok(writes.every(({ file, bytes }) => file === 'fixture.glb' && bytes === payload));
});

check('does not retry a permanent write failure', () => {
  let writes = 0;
  const waits = [];
  assert.throws(
    () => writeFileWithRetry('fixture.glb', Buffer.alloc(0), {
      retryDelaysMs: [1, 2, 3],
      wait: (milliseconds) => waits.push(milliseconds),
      writeFile: () => {
        writes += 1;
        throw fileError('ENOSPC');
      },
    }),
    (error) => error.code === 'ENOSPC',
  );
  assert.equal(writes, 1);
  assert.deepEqual(waits, []);
});

check('bounds repeated transient failures to the configured attempts', () => {
  let writes = 0;
  const waits = [];
  assert.throws(
    () => writeFileWithRetry('fixture.glb', Buffer.alloc(0), {
      retryDelaysMs: [10, 20, 30],
      wait: (milliseconds) => waits.push(milliseconds),
      writeFile: () => {
        writes += 1;
        throw fileError('EBUSY');
      },
    }),
    (error) => error.code === 'EBUSY',
  );
  assert.equal(writes, 4);
  assert.deepEqual(waits, [10, 20, 30]);
});

if (failures) {
  console.error(`\n${failures} write retry check(s) failed.`);
  process.exit(1);
}

console.log('\nWrite retry contract passed.');
