import { chromium } from '@playwright/test';
import path from 'path';

const DIST = path.resolve(process.cwd(), 'dist');
const PROFILE = path.resolve(process.cwd(), 'e2e/.chrome-profile');

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
  ],
});

await new Promise(r => setTimeout(r, 4000));

const sws = ctx.serviceWorkers();
console.log('Service workers:', sws.map(s => s.url()));

const pages = ctx.pages();
for (const p of pages) console.log('Page:', p.url());

// Try CDP to list all targets
const page = pages[0] ?? await ctx.newPage();
const client = await ctx.newCDPSession(page);
const { targetInfos } = await client.send('Target.getTargets');
console.log('\nAll targets:');
for (const t of targetInfos) console.log(' ', t.type, t.url);

await ctx.close();
