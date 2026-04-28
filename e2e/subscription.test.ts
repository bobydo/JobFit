import { test, expect, BrowserContext } from '@playwright/test';
import {
  launchExtensionContext,
  openPopup,
  setStorage,
  removeStorage,
} from './helpers';

let context: BrowserContext;

test.beforeAll(async () => {
  context = await launchExtensionContext();
});

test.afterAll(async () => {
  await context.close();
});

test.beforeEach(async () => {
  await removeStorage(context, ['subscriptionToken', 'subscriptionPlan', 'mode']);
});

test('shows "pro active" when token and plan are in storage', async () => {
  await setStorage(context, {
    subscriptionToken: 'test-token-123',
    subscriptionPlan: 'pro',
    mode: 'jobfit-cloud',
  });
  const popup = await openPopup(context);
  await popup.route('**/validate-token', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) })
  );
  await popup.getByText('Settings').click();
  await expect(popup.getByText('pro active')).toBeVisible();
  await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  await popup.close();
});

test('shows Subscribe button when no token', async () => {
  const popup = await openPopup(context);
  await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  await popup.getByText('Settings').click();
  await popup.getByText('JobFit Pro').click();
  await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  await popup.close();
});

test('Subscribe button opens Stripe checkout tab', async () => {
  const popup = await openPopup(context);
  await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  await popup.getByText('Settings').click();
  await popup.getByText('JobFit Pro').click();
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: /Subscribe →/ }).click(),
  ]);
  expect(newPage.url()).toContain('stripe.com');
  await newPage.close();
  await popup.close();
});

test('Manage subscription button is visible when pro active', async () => {
  await setStorage(context, {
    subscriptionToken: 'test-token-123',
    subscriptionPlan: 'pro',
    mode: 'jobfit-cloud',
  });
  const popup = await openPopup(context);
  await popup.route('**/validate-token', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) })
  );
  await popup.getByText('Settings').click();
  await expect(popup.getByRole('button', { name: /Manage subscription/ })).toBeVisible();
  await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  await popup.close();
});

test('Pro inactive after token removed — open, close, reopen', async () => {
  // First open: pro active
  await setStorage(context, {
    subscriptionToken: 'test-token-xyz',
    subscriptionPlan: 'pro',
    mode: 'jobfit-cloud',
  });
  await context.route('**/validate-token', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) })
  );
  const popup1 = await openPopup(context);
  await popup1.getByText('Settings').click();
  await expect(popup1.getByText('pro active')).toBeVisible();
  await popup1.close();

  // Simulate subscription cancelled: token deleted, validate-token now 401
  await removeStorage(context, ['subscriptionToken', 'subscriptionPlan']);
  await context.unroute('**/validate-token');
  await context.route('**/validate-token',     route => route.fulfill({ status: 401 }));
  await context.route('**/check-subscription', route => route.fulfill({ status: 404 }));

  // Reopen — should show inactive
  const popup2 = await openPopup(context);
  await popup2.getByText('Settings').click();
  await popup2.locator('label', { hasText: 'JobFit Pro' }).click();
  await expect(popup2.getByText('pro active')).not.toBeVisible();
  await expect(popup2.getByRole('button', { name: /Subscribe →/ })).toBeVisible();
  await expect(popup2.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  await popup2.close();

  await context.unroute('**/validate-token');
  await context.unroute('**/check-subscription');
});
