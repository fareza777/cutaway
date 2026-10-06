import { writeFileSync } from 'node:fs';

const TRANSIENT_WINDOWS_WRITE_CODES = new Set(['UNKNOWN', 'EBUSY', 'EACCES', 'EPERM']);
const DEFAULT_RETRY_DELAYS_MS = [40, 120, 300, 700];
const WAIT_BUFFER = new Int32Array(new SharedArrayBuffer(4));

function waitSync(milliseconds) {
  Atomics.wait(WAIT_BUFFER, 0, 0, milliseconds);
}

/**
 * Write a generated artifact while tolerating only short-lived Windows locks.
 * Permanent failures still surface immediately, and transient retries are
 * bounded so a genuinely locked file cannot hang a release build.
 */
export function writeFileWithRetry(
  file,
  data,
  {
    writeFile = writeFileSync,
    wait = waitSync,
    retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      writeFile(file, data);
      return;
    } catch (error) {
      const canRetry = TRANSIENT_WINDOWS_WRITE_CODES.has(error?.code) && attempt < retryDelaysMs.length;
      if (!canRetry) throw error;
      wait(retryDelaysMs[attempt]);
    }
  }
}
