import { writeFileSync, mkdirSync } from 'fs';
import { basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { TEST_LOG_DIR } from '../config';

/**
 * Write a JSON object to src/logs/ named after the calling test file + timestamp.
 * Example: langfuse-tracer.test.ts → langfuse-tracer-test-ts-2026-04-06-134500.log
 *
 * @param callerUrl  pass `import.meta.url` from the test file
 * @param data       any JSON-serialisable value
 * @returns          the resolved file path
 */
export function writeTestLog(callerUrl: string, data: unknown): string {
  const scriptName = basename(fileURLToPath(callerUrl)).replace(/\./g, '-');
  const ts = new Date().toISOString().replace('T', '-').replace(/:/g, '').slice(0, 17); // yyyy-mm-dd-hhmmss
  const filename = `${scriptName}-${ts}.log`;

  const dir = resolve(TEST_LOG_DIR);
  mkdirSync(dir, { recursive: true });
  const logPath = resolve(dir, filename);
  writeFileSync(logPath, JSON.stringify(data, null, 2), 'utf-8');
  return logPath;
}
