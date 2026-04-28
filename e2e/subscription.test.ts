import { test, expect, BrowserContext } from '@playwright/test';
import { launchExtensionContext, openPopup, setStorage, removeStorage, readEnv } from './helpers';

const TEST_TOKEN  = readEnv('TEST_SUBSCRIPTION_TOKEN');
const TEST_PLAN   = readEnv('TEST_SUBSCRIPTION_PLAN');
const TEST_MODE   = readEnv('TEST_LLM_MODE');
const UI_SETTINGS    = readEnv('TEST_UI_SETTINGS');
const UI_JOBFIT_PRO  = readEnv('TEST_UI_JOBFIT_PRO');
const UI_PRO_ACTIVE  = readEnv('TEST_UI_PRO_ACTIVE');

let context: BrowserContext;

test.beforeAll(async () => { context = await launchExtensionContext(); });
test.afterAll(async ()  => { await context.close(); });
test.beforeEach(async () => {
  await removeStorage(context, ['subscriptionToken', 'subscriptionPlan', 'mode']);
});

test('shows "pro active" when token and plan are in storage', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  const popup = await openPopup(context);
  await popup.route('**/validate-token', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  );
  await popup.getByText(UI_SETTINGS).click();
  await expect(popup.getByText(UI_PRO_ACTIVE)).toBeVisible();
  await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  await popup.close();
});

test('shows Subscribe button when no token', async () => {
  const popup = await openPopup(context);
  await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  await popup.getByText(UI_SETTINGS).click();
  await popup.getByText(UI_JOBFIT_PRO).click();
  await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  await popup.close();
});

test('Subscribe button opens Stripe checkout tab', async () => {
  const popup = await openPopup(context);
  await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  await popup.getByText(UI_SETTINGS).click();
  await popup.getByText(UI_JOBFIT_PRO).click();
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: /Subscribe →/ }).click(),
  ]);
  expect(newPage.url()).toContain('stripe.com');
  await newPage.close();
  await popup.close();
});

test('Manage subscription button is visible when pro active', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  const popup = await openPopup(context);
  await popup.route('**/validate-token', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  );
  await popup.getByText(UI_SETTINGS).click();
  await expect(popup.getByRole('button', { name: /Manage subscription/ })).toBeVisible();
  await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  await popup.close();
});

test('Pro inactive after token removed — open, close, reopen', async () => {
  await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  await context.route('**/validate-token', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  );
  const popup1 = await openPopup(context);
  await popup1.getByText(UI_SETTINGS).click();
  await expect(popup1.getByText(UI_PRO_ACTIVE)).toBeVisible();
  await popup1.close();

  await removeStorage(context, ['subscriptionToken', 'subscriptionPlan']);
  await context.unroute('**/validate-token');
  await context.route('**/validate-token',     route => route.fulfill({ status: 401 }));
  await context.route('**/check-subscription', route => route.fulfill({ status: 404 }));

  const popup2 = await openPopup(context);
  await popup2.getByText(UI_SETTINGS).click();
  await popup2.locator('label', { hasText: UI_JOBFIT_PRO }).click();
  await expect(popup2.getByText(UI_PRO_ACTIVE)).not.toBeVisible();
  await expect(popup2.getByRole('button', { name: /Subscribe →/ })).toBeVisible();
  await expect(popup2.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  await popup2.close();

  await context.unroute('**/validate-token');
  await context.unroute('**/check-subscription');
});
