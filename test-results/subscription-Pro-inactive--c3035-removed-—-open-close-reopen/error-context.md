# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subscription.test.ts >> Pro inactive after token removed — open, close, reopen
- Location: e2e\subscription.test.ts:77:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for getByText('Settings')

```

# Test source

```ts
  1   | import { test, expect, BrowserContext } from '@playwright/test';
  2   | import {
  3   |   launchExtensionContext,
  4   |   openPopup,
  5   |   setStorage,
  6   |   removeStorage,
  7   | } from './helpers';
  8   | 
  9   | let context: BrowserContext;
  10  | 
  11  | test.beforeAll(async () => {
  12  |   context = await launchExtensionContext();
  13  | });
  14  | 
  15  | test.afterAll(async () => {
  16  |   await context.close();
  17  | });
  18  | 
  19  | test.beforeEach(async () => {
  20  |   await removeStorage(context, ['subscriptionToken', 'subscriptionPlan', 'mode']);
  21  | });
  22  | 
  23  | test('shows "pro active" when token and plan are in storage', async () => {
  24  |   await setStorage(context, {
  25  |     subscriptionToken: 'test-token-123',
  26  |     subscriptionPlan: 'pro',
  27  |     mode: 'jobfit-cloud',
  28  |   });
  29  |   const popup = await openPopup(context);
  30  |   await popup.route('**/validate-token', route =>
  31  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) })
  32  |   );
  33  |   await popup.getByText('Settings').click();
  34  |   await expect(popup.getByText('pro active')).toBeVisible();
  35  |   await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  36  |   await popup.close();
  37  | });
  38  | 
  39  | test('shows Subscribe button when no token', async () => {
  40  |   const popup = await openPopup(context);
  41  |   await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  42  |   await popup.getByText('Settings').click();
  43  |   await popup.getByText('JobFit Pro').click();
  44  |   await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  45  |   await popup.close();
  46  | });
  47  | 
  48  | test('Subscribe button opens Stripe checkout tab', async () => {
  49  |   const popup = await openPopup(context);
  50  |   await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  51  |   await popup.getByText('Settings').click();
  52  |   await popup.getByText('JobFit Pro').click();
  53  |   const [newPage] = await Promise.all([
  54  |     context.waitForEvent('page'),
  55  |     popup.getByRole('button', { name: /Subscribe →/ }).click(),
  56  |   ]);
  57  |   expect(newPage.url()).toContain('stripe.com');
  58  |   await newPage.close();
  59  |   await popup.close();
  60  | });
  61  | 
  62  | test('Manage subscription button is visible when pro active', async () => {
  63  |   await setStorage(context, {
  64  |     subscriptionToken: 'test-token-123',
  65  |     subscriptionPlan: 'pro',
  66  |     mode: 'jobfit-cloud',
  67  |   });
  68  |   const popup = await openPopup(context);
  69  |   await popup.route('**/validate-token', route =>
  70  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) })
  71  |   );
  72  |   await popup.getByText('Settings').click();
  73  |   await expect(popup.getByRole('button', { name: /Manage subscription/ })).toBeVisible();
  74  |   await popup.close();
  75  | });
  76  | 
  77  | test('Pro inactive after token removed — open, close, reopen', async () => {
  78  |   // First open: pro active
  79  |   await setStorage(context, {
  80  |     subscriptionToken: 'test-token-xyz',
  81  |     subscriptionPlan: 'pro',
  82  |     mode: 'jobfit-cloud',
  83  |   });
  84  |   await context.route('**/validate-token', route =>
  85  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'pro' }) })
  86  |   );
  87  |   const popup1 = await openPopup(context);
> 88  |   await popup1.getByText('Settings').click();
      |                                      ^ Error: locator.click: Target page, context or browser has been closed
  89  |   await expect(popup1.getByText('pro active')).toBeVisible();
  90  |   await popup1.close();
  91  | 
  92  |   // Simulate subscription cancelled: token deleted, validate-token now 401
  93  |   await removeStorage(context, ['subscriptionToken', 'subscriptionPlan']);
  94  |   await context.unroute('**/validate-token');
  95  |   await context.route('**/validate-token',     route => route.fulfill({ status: 401 }));
  96  |   await context.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  97  | 
  98  |   // Reopen — should show inactive
  99  |   const popup2 = await openPopup(context);
  100 |   await popup2.getByText('Settings').click();
  101 |   await popup2.getByText('JobFit Pro').click();
  102 |   await expect(popup2.getByText('pro active')).not.toBeVisible();
  103 |   await expect(popup2.getByRole('button', { name: /Subscribe →/ })).toBeVisible();
  104 |   await popup2.close();
  105 | 
  106 |   await context.unroute('**/validate-token');
  107 |   await context.unroute('**/check-subscription');
  108 | });
  109 | 
```