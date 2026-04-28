/**
 * Full payment + cancellation integration tests.
 *
 * Prerequisites (must be running before npm run test:e2e):
 *   cd worker && wrangler dev          (local worker on localhost:8787)
 *   stripe listen --forward-to localhost:8787/webhook
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';
import { launchExtensionContext, openPopup, setStorage, removeStorage, readEnv } from './helpers';

const STRIPE_PRO_URL       = readEnv('VITE_STRIPE_PRO_URL');
const WORKER_URL            = readEnv('TEST_WORKER_URL');
const TEST_EMAIL            = readEnv('TEST_EMAIL');
const TEST_CARDHOLDER_NAME  = readEnv('TEST_CARDHOLDER_NAME');
const TEST_CARD_NUMBER      = readEnv('TEST_CARD_NUMBER');
const TEST_CARD_EXPIRY      = readEnv('TEST_CARD_EXPIRY');
const TEST_CARD_CVC         = readEnv('TEST_CARD_CVC');
const TEST_TOKEN            = readEnv('TEST_SUBSCRIPTION_TOKEN');
const TEST_PLAN             = readEnv('TEST_SUBSCRIPTION_PLAN');
const TEST_MODE             = readEnv('TEST_LLM_MODE');
const TEST_PLAN_PRICE       = readEnv('TEST_PLAN_PRICE');
const UI_SETTINGS           = readEnv('TEST_UI_SETTINGS');
const UI_JOBFIT_PRO         = readEnv('TEST_UI_JOBFIT_PRO');
const UI_PRO_ACTIVE         = readEnv('TEST_UI_PRO_ACTIVE');
const UI_PRO_INACTIVE       = readEnv('TEST_UI_PRO_INACTIVE');
const UI_CANCELS_LABEL      = readEnv('TEST_UI_CANCELS_LABEL');
const UI_DONT_CANCEL        = readEnv('TEST_UI_DONT_CANCEL');
const UI_RENEW_SUBSCRIPTION = readEnv('TEST_UI_RENEW_SUBSCRIPTION');
const UI_RENEW_YOUR_SUB     = readEnv('TEST_UI_RENEW_YOUR_SUBSCRIPTION');

let context: BrowserContext;

test.beforeAll(async () => { context = await launchExtensionContext(); });
test.afterAll(async ()  => { await context.close(); });
test.beforeEach(async () => {
  await removeStorage(context, ['subscriptionToken', 'subscriptionPlan', 'mode']);
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function openSettingsPro(popup: Page) {
  await popup.getByText(UI_SETTINGS).click();
  await popup.locator('label', { hasText: UI_JOBFIT_PRO }).click();
}

async function fillStripeCard(stripePage: Page) {
  await stripePage.waitForLoadState('networkidle');
  // Select "Card" payment method if not already selected
  await stripePage.getByText('Card').click();
  const cardFrame = stripePage.frameLocator('iframe[src*="js.stripe.com"]').first();
  await cardFrame.locator('[placeholder="Card number"]').fill(TEST_CARD_NUMBER);
  await cardFrame.locator('[placeholder="MM / YY"]').fill(TEST_CARD_EXPIRY);
  await cardFrame.locator('[placeholder="CVC"]').fill(TEST_CARD_CVC);
  const nameField = stripePage.locator('input[placeholder*="name" i], input[id*="cardholderName" i]').first();
  await nameField.fill(TEST_CARDHOLDER_NAME);
}

// ── Test 1: Subscribe flow ─────────────────────────────────────────────────

test('Subscribe → fill test card → payment confirmed', async () => {
  const popup = await openPopup(context);
  await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  await openSettingsPro(popup);

  await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();

  const [stripePage] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: /Subscribe →/ }).click(),
  ]);

  expect(stripePage.url()).toContain('stripe.com');
  await fillStripeCard(stripePage);
  await stripePage.getByRole('button', { name: /^Subscribe$/i }).click();

  await expect(stripePage.getByText('Thanks for subscribing')).toBeVisible({ timeout: 20_000 });
  await expect(stripePage.getByText(TEST_EMAIL)).toBeVisible();

  await stripePage.close();
  await popup.close();
});

// ── Test 2: Post-payment state ─────────────────────────────────────────────

test('After payment: Subscribe disabled, Manage subscription enabled', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  const popup = await openPopup(context);
  await popup.route(`${WORKER_URL}/validate-token`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  );
  await popup.getByText(UI_SETTINGS).click();

  await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  await expect(popup.getByRole('button', { name: /Manage subscription/ })).toBeEnabled();
  await popup.close();
});

// ── Test 3: Manage subscription portal ────────────────────────────────────

test('Manage subscription → portal shows name, email, plan, cancel button', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  const popup = await openPopup(context);
  await popup.route(`${WORKER_URL}/validate-token`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  );
  await popup.getByText(UI_SETTINGS).click();

  const [portalPage] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: /Manage subscription/ }).click(),
  ]);

  await portalPage.waitForLoadState('networkidle');
  expect(portalPage.url()).toContain('billing.stripe.com');

  await expect(portalPage.getByText(TEST_CARDHOLDER_NAME)).toBeVisible();
  await expect(portalPage.getByText(TEST_EMAIL)).toBeVisible();
  await expect(portalPage.getByText(UI_JOBFIT_PRO)).toBeVisible();
  await expect(portalPage.getByText(TEST_PLAN_PRICE)).toBeVisible();
  await expect(portalPage.getByRole('button', { name: /Cancel subscription/i })).toBeVisible();

  await portalPage.close();
  await popup.close();
});

// ── Test 4: After cancel_at_period_end — extension shows cancellation date ─
// Simulates the state after user cancels via Stripe portal with cancel_at_period_end=true:
// token still valid in KV (period not over), but validate-token now returns cancelAt.

test('Cancel subscription → after cancel_at_period_end=true → extension shows cancellation date [BUG: currently shows active without warning]', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });

  await context.route('**/validate-token', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ plan: TEST_PLAN, cancelAt: '2026-05-28' }),
    })
  );

  const popup = await openPopup(context);
  await popup.getByText(UI_SETTINGS).click();

  await expect(popup.getByText(new RegExp(UI_CANCELS_LABEL, 'i'))).toBeVisible({ timeout: 5_000 });
  await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();

  await popup.close();
  await context.unroute('**/validate-token');
});

// ── Test 5: Don't cancel → Renew → Pro active ────────────────────────────

test('Manage subscription (cancelled) → Don\'t cancel → Renew → pro active', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  const popup = await openPopup(context);
  await popup.route(`${WORKER_URL}/validate-token`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  );
  await popup.getByText(UI_SETTINGS).click();

  // Step 1: Open portal — subscription already cancelled (shows "Cancels May 28")
  const [portalPage] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: /Manage subscription/ }).click(),
  ]);
  await portalPage.waitForLoadState('networkidle');
  expect(portalPage.url()).toContain('billing.stripe.com');

  // Step 2: Portal shows cancelled date, name, email, "Don't cancel subscription" button
  await expect(portalPage.getByText(/Cancels/i)).toBeVisible();
  await expect(portalPage.getByText(TEST_CARDHOLDER_NAME)).toBeVisible();
  await expect(portalPage.getByText(TEST_EMAIL)).toBeVisible();
  await expect(portalPage.getByRole('button', { name: new RegExp(UI_DONT_CANCEL, 'i') })).toBeVisible();

  // Step 3: Click "Don't cancel subscription"
  await portalPage.getByRole('button', { name: new RegExp(UI_DONT_CANCEL, 'i') }).click();

  // Step 4: "Renew your subscription" page appears
  await expect(portalPage.getByText(UI_RENEW_YOUR_SUB)).toBeVisible({ timeout: 10_000 });
  await expect(portalPage.getByText(UI_JOBFIT_PRO)).toBeVisible();
  await expect(portalPage.getByText(TEST_PLAN_PRICE)).toBeVisible();
  await expect(portalPage.getByRole('button', { name: new RegExp(UI_RENEW_SUBSCRIPTION, 'i') })).toBeVisible();

  // Step 5: Click "Renew subscription"
  await portalPage.getByRole('button', { name: new RegExp(UI_RENEW_SUBSCRIPTION, 'i') }).click();
  await portalPage.waitForLoadState('networkidle');

  await portalPage.close();
  await popup.close();

  // Step 6: Reopen extension — should show "pro active", Subscribe disabled
  const popup2 = await openPopup(context);
  await popup2.getByText(UI_SETTINGS).click();
  await expect(popup2.getByText(UI_PRO_ACTIVE)).toBeVisible({ timeout: 5_000 });
  await expect(popup2.getByRole('button', { name: /Subscribed/ })).toBeDisabled();

  await popup2.close();
});

// ── TDD: Bug 1 — extension shows "pro inactive" after webhook fires ─────────
// RED now (shows "pro active"). GREEN after fix: worker deletes KV on cancel,
// extension detects 401 → auto-heals → check-subscription 404 → shows inactive.

test('[BUG 1 - TDD] After subscription.deleted webhook: extension shows pro inactive', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });

  // Simulate webhook fired: token wiped from KV → validate-token 401 → check-subscription 404
  await context.route('**/validate-token',     route => route.fulfill({ status: 401 }));
  await context.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  await removeStorage(context, ['subscriptionToken', 'subscriptionPlan']);

  const popup = await openPopup(context);
  await popup.getByText(UI_SETTINGS).click();
  await popup.locator('label', { hasText: UI_JOBFIT_PRO }).click();

  // Should show inactive — currently FAILS (shows "pro active")
  await expect(popup.getByText(UI_PRO_INACTIVE)).toBeVisible({ timeout: 5_000 });
  await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();

  await popup.close();
  await context.unroute('**/validate-token');
  await context.unroute('**/check-subscription');
});

// ── TDD: Bug 2 — extension shows cancellation date when cancel_at_period_end ─
// RED now (shows plain "pro active"). GREEN after fix: validate-token returns
// cancelAt date, extension surfaces "Cancels <date>" warning in Settings.

test('[BUG 2 - TDD] When cancel_at_period_end=true: extension shows cancellation date', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });

  // Simulate worker returning cancelAt alongside the active plan
  await context.route('**/validate-token', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ plan: TEST_PLAN, cancelAt: '2026-05-28' }),
    })
  );

  const popup = await openPopup(context);
  await popup.getByText(UI_SETTINGS).click();

  // Should show cancellation warning — currently FAILS (extension ignores cancelAt)
  await expect(popup.getByText(new RegExp(UI_CANCELS_LABEL, 'i'))).toBeVisible({ timeout: 5_000 });

  await popup.close();
  await context.unroute('**/validate-token');
});
