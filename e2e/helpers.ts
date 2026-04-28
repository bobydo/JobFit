import { chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

declare const chrome: any;

const DIST_PATH   = path.resolve(process.cwd(), 'dist').replace(/\\/g, '/');
const PROFILE_DIR = path.resolve(process.cwd(), 'e2e/.chrome-profile');
const LOCAL_URL   = 'http://localhost:0/'; // intercepted by page.route — no real server needed

export const EXT_ID = 'djfaajdpdibhglnkjjpahfagkjmllopl';

export async function launchExtensionContext(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
    ],
  });
}

// Opens a virtual localhost page so chrome.runtime.sendMessage is allowed
// by the manifest's externally_connectable (http://localhost/*)
async function localPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.route(LOCAL_URL, route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' })
  );
  await page.goto(LOCAL_URL);
  return page;
}

async function sendMsg(context: BrowserContext, msg: Record<string, unknown>): Promise<unknown> {
  const page = await localPage(context);
  try {
    return await page.evaluate(
      ([extId, m]: [string, Record<string, unknown>]) =>
        new Promise(resolve => chrome.runtime.sendMessage(extId, m, resolve)),
      [EXT_ID, msg] as [string, Record<string, unknown>],
    );
  } finally {
    await page.close();
  }
}

export async function getStorage(context: BrowserContext, keys: string[]): Promise<Record<string, unknown>> {
  return sendMsg(context, { type: 'GET_STORAGE', keys }) as Promise<Record<string, unknown>>;
}

export async function setStorage(context: BrowserContext, payload: Record<string, unknown>): Promise<void> {
  await sendMsg(context, { type: 'SET_STORAGE', payload });
}

export async function removeStorage(context: BrowserContext, keys: string[]): Promise<void> {
  await sendMsg(context, { type: 'REMOVE_STORAGE', keys });
}

export async function openPopup(context: BrowserContext): Promise<Page> {
  // Open messenger page first so waitForEvent doesn't catch it instead of the real popup
  const messenger = await localPage(context);
  const popupPromise = context.waitForEvent('page');
  await messenger.evaluate(
    ([extId, m]: [string, Record<string, unknown>]) =>
      new Promise(resolve => chrome.runtime.sendMessage(extId, m, resolve)),
    [EXT_ID, { type: 'OPEN_POPUP' }] as [string, Record<string, unknown>],
  );
  const popup = await popupPromise;
  await messenger.close();
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}
