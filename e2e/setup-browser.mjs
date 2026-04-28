/**
 * One-time setup: launches Chromium WITHOUT automation flags so Google
 * allows sign-in. Sign into Gmail, verify the JobFit extension loads,
 * then close the browser — the profile is saved automatically.
 *
 * Run: node e2e/setup-browser.mjs
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const dir     = path.dirname(fileURLToPath(import.meta.url));
const DIST    = path.resolve(dir, '../dist');
const PROFILE = path.resolve(dir, '.chrome-profile');

// Playwright's Chromium — no --enable-automation so Google allows sign-in
const CHROMIUM = 'C:\\Users\\baosh\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe';

console.log('\n=== JobFit E2E — One-Time Browser Setup ===\n');
console.log('1. Sign into Gmail in the browser that opens');
console.log('2. Confirm the JobFit (J) extension icon appears in the toolbar');
console.log('3. Close the browser when done — profile is saved automatically\n');

const proc = spawn(CHROMIUM, [
  `--user-data-dir=${PROFILE}`,
  `--load-extension=${DIST}`,
  '--no-first-run',
  '--no-default-browser-check',
  'https://mail.google.com',
], { stdio: 'ignore', detached: false });

proc.on('exit', () => {
  console.log('Profile saved. You can now run: npm run test:e2e\n');
});
