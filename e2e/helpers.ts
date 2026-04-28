import { chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

declare const chrome: any;

const DIST_PATH   = path.resolve(process.cwd(), 'dist');
const PROFILE_DIR = path.resolve(process.cwd(), 'e2e/.chrome-profile');

export const EXT_ID = 'djfaajdpdibhglnkjjpahfagkjmllopl';
const POPUP_URL = `chrome-extension://${EXT_ID}/src/popup/popup.html`;

export async function launchExtensionContext(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_PATH}`,
      `--load-extension=${DIST_PATH}`,
    ],
  });
}

export async function openPopup(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(POPUP_URL);
  return page;
}

// Runs chrome.storage calls inside the extension popup page where chrome APIs are available
async function withPopup<T>(context: BrowserContext, fn: (page: Page) => Promise<T>): Promise<T> {
  const page = await context.newPage();
  await page.goto(POPUP_URL);
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

export async function getStorage(context: BrowserContext, keys: string[]): Promise<Record<string, unknown>> {
  return withPopup(context, page =>
    page.evaluate(
      (k: string[]) => new Promise<Record<string, unknown>>(resolve => chrome.storage.sync.get(k, resolve)),
      keys,
    )
  );
}

export async function setStorage(context: BrowserContext, payload: Record<string, unknown>): Promise<void> {
  return withPopup(context, page =>
    page.evaluate(
      (p: Record<string, unknown>) => new Promise<void>(resolve => chrome.storage.sync.set(p, resolve)),
      payload,
    )
  );
}

export async function removeStorage(context: BrowserContext, keys: string[]): Promise<void> {
  return withPopup(context, page =>
    page.evaluate(
      (k: string[]) => new Promise<void>(resolve => chrome.storage.sync.remove(k, resolve)),
      keys,
    )
  );
}
