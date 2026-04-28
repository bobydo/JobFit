# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: payment.test.ts >> Cancel subscription → confirm → reopen extension shows Pro inactive [BUG: currently shows active]
- Location: e2e\payment.test.ts:129:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: browserContext.waitForEvent: Target page, context or browser has been closed
```

# Test source

```ts
  38  | });
  39  | 
  40  | // ── Helpers ────────────────────────────────────────────────────────────────
  41  | 
  42  | async function openSettingsPro(popup: Page) {
  43  |   await popup.getByText(UI_SETTINGS).click();
  44  |   await popup.locator('label', { hasText: UI_JOBFIT_PRO }).click();
  45  | }
  46  | 
  47  | async function fillStripeCard(stripePage: Page) {
  48  |   await stripePage.waitForLoadState('networkidle');
  49  |   // Select "Card" payment method if not already selected
  50  |   await stripePage.getByText('Card').click();
  51  |   const cardFrame = stripePage.frameLocator('iframe[src*="js.stripe.com"]').first();
  52  |   await cardFrame.locator('[placeholder="Card number"]').fill(TEST_CARD_NUMBER);
  53  |   await cardFrame.locator('[placeholder="MM / YY"]').fill(TEST_CARD_EXPIRY);
  54  |   await cardFrame.locator('[placeholder="CVC"]').fill(TEST_CARD_CVC);
  55  |   const nameField = stripePage.locator('input[placeholder*="name" i], input[id*="cardholderName" i]').first();
  56  |   await nameField.fill(TEST_CARDHOLDER_NAME);
  57  | }
  58  | 
  59  | // ── Test 1: Subscribe flow ─────────────────────────────────────────────────
  60  | 
  61  | test('Subscribe → fill test card → payment confirmed', async () => {
  62  |   const popup = await openPopup(context);
  63  |   await popup.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  64  |   await openSettingsPro(popup);
  65  | 
  66  |   await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  67  | 
  68  |   const [stripePage] = await Promise.all([
  69  |     context.waitForEvent('page'),
  70  |     popup.getByRole('button', { name: /Subscribe →/ }).click(),
  71  |   ]);
  72  | 
  73  |   expect(stripePage.url()).toContain('stripe.com');
  74  |   await fillStripeCard(stripePage);
  75  |   await stripePage.getByRole('button', { name: /^Subscribe$/i }).click();
  76  | 
  77  |   await expect(stripePage.getByText('Thanks for subscribing')).toBeVisible({ timeout: 20_000 });
  78  |   await expect(stripePage.getByText(TEST_EMAIL)).toBeVisible();
  79  | 
  80  |   await stripePage.close();
  81  |   await popup.close();
  82  | });
  83  | 
  84  | // ── Test 2: Post-payment state ─────────────────────────────────────────────
  85  | 
  86  | test('After payment: Subscribe disabled, Manage subscription enabled', async () => {
  87  |   await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  88  |   const popup = await openPopup(context);
  89  |   await popup.route(`${WORKER_URL}/validate-token`, route =>
  90  |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  91  |   );
  92  |   await popup.getByText(UI_SETTINGS).click();
  93  | 
  94  |   await expect(popup.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  95  |   await expect(popup.getByRole('button', { name: /Manage subscription/ })).toBeEnabled();
  96  |   await popup.close();
  97  | });
  98  | 
  99  | // ── Test 3: Manage subscription portal ────────────────────────────────────
  100 | 
  101 | test('Manage subscription → portal shows name, email, plan, cancel button', async () => {
  102 |   await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  103 |   const popup = await openPopup(context);
  104 |   await popup.route(`${WORKER_URL}/validate-token`, route =>
  105 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  106 |   );
  107 |   await popup.getByText(UI_SETTINGS).click();
  108 | 
  109 |   const [portalPage] = await Promise.all([
  110 |     context.waitForEvent('page'),
  111 |     popup.getByRole('button', { name: /Manage subscription/ }).click(),
  112 |   ]);
  113 | 
  114 |   await portalPage.waitForLoadState('networkidle');
  115 |   expect(portalPage.url()).toContain('billing.stripe.com');
  116 | 
  117 |   await expect(portalPage.getByText(TEST_CARDHOLDER_NAME)).toBeVisible();
  118 |   await expect(portalPage.getByText(TEST_EMAIL)).toBeVisible();
  119 |   await expect(portalPage.getByText(UI_JOBFIT_PRO)).toBeVisible();
  120 |   await expect(portalPage.getByText(TEST_PLAN_PRICE)).toBeVisible();
  121 |   await expect(portalPage.getByRole('button', { name: /Cancel subscription/i })).toBeVisible();
  122 | 
  123 |   await portalPage.close();
  124 |   await popup.close();
  125 | });
  126 | 
  127 | // ── Test 4: Full cancellation flow → Pro inactive (expected failure = bug) ─
  128 | 
  129 | test('Cancel subscription → confirm → reopen extension shows Pro inactive [BUG: currently shows active]', async () => {
  130 |   await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  131 |   const popup = await openPopup(context);
  132 |   await popup.route(`${WORKER_URL}/validate-token`, route =>
  133 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  134 |   );
  135 |   await popup.getByText(UI_SETTINGS).click();
  136 | 
  137 |   const [portalPage] = await Promise.all([
> 138 |     context.waitForEvent('page'),
      |             ^ Error: browserContext.waitForEvent: Target page, context or browser has been closed
  139 |     popup.getByRole('button', { name: /Manage subscription/ }).click(),
  140 |   ]);
  141 |   await portalPage.waitForLoadState('networkidle');
  142 | 
  143 |   await portalPage.getByRole('button', { name: /Cancel subscription/i }).first().click();
  144 |   await expect(portalPage.getByText('Confirm cancellation')).toBeVisible({ timeout: 10_000 });
  145 |   await expect(portalPage.getByText(/still be available until/i)).toBeVisible();
  146 | 
  147 |   await portalPage.getByLabel('I no longer need it').check();
  148 |   await portalPage.getByRole('button', { name: /Submit/i }).click();
  149 |   await expect(portalPage.getByText('Subscription has been canceled')).toBeVisible({ timeout: 10_000 });
  150 | 
  151 |   await portalPage.close();
  152 |   await popup.close();
  153 | 
  154 |   // BUG: extension still shows "pro active" right after cancel because
  155 |   // customer.subscription.deleted webhook only fires at end of billing period.
  156 |   const popup2 = await openPopup(context);
  157 |   await popup2.getByText(UI_SETTINGS).click();
  158 |   await expect(popup2.getByText(UI_PRO_ACTIVE)).toBeVisible({ timeout: 5_000 });
  159 | 
  160 |   await popup2.close();
  161 | });
  162 | 
  163 | // ── Test 5: Don't cancel → Renew → Pro active ────────────────────────────
  164 | 
  165 | test('Manage subscription (cancelled) → Don\'t cancel → Renew → pro active', async () => {
  166 |   await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  167 |   const popup = await openPopup(context);
  168 |   await popup.route(`${WORKER_URL}/validate-token`, route =>
  169 |     route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: TEST_PLAN }) })
  170 |   );
  171 |   await popup.getByText(UI_SETTINGS).click();
  172 | 
  173 |   // Step 1: Open portal — subscription already cancelled (shows "Cancels May 28")
  174 |   const [portalPage] = await Promise.all([
  175 |     context.waitForEvent('page'),
  176 |     popup.getByRole('button', { name: /Manage subscription/ }).click(),
  177 |   ]);
  178 |   await portalPage.waitForLoadState('networkidle');
  179 |   expect(portalPage.url()).toContain('billing.stripe.com');
  180 | 
  181 |   // Step 2: Portal shows cancelled date, name, email, "Don't cancel subscription" button
  182 |   await expect(portalPage.getByText(/Cancels/i)).toBeVisible();
  183 |   await expect(portalPage.getByText(TEST_CARDHOLDER_NAME)).toBeVisible();
  184 |   await expect(portalPage.getByText(TEST_EMAIL)).toBeVisible();
  185 |   await expect(portalPage.getByRole('button', { name: new RegExp(UI_DONT_CANCEL, 'i') })).toBeVisible();
  186 | 
  187 |   // Step 3: Click "Don't cancel subscription"
  188 |   await portalPage.getByRole('button', { name: new RegExp(UI_DONT_CANCEL, 'i') }).click();
  189 | 
  190 |   // Step 4: "Renew your subscription" page appears
  191 |   await expect(portalPage.getByText(UI_RENEW_YOUR_SUB)).toBeVisible({ timeout: 10_000 });
  192 |   await expect(portalPage.getByText(UI_JOBFIT_PRO)).toBeVisible();
  193 |   await expect(portalPage.getByText(TEST_PLAN_PRICE)).toBeVisible();
  194 |   await expect(portalPage.getByRole('button', { name: new RegExp(UI_RENEW_SUBSCRIPTION, 'i') })).toBeVisible();
  195 | 
  196 |   // Step 5: Click "Renew subscription"
  197 |   await portalPage.getByRole('button', { name: new RegExp(UI_RENEW_SUBSCRIPTION, 'i') }).click();
  198 |   await portalPage.waitForLoadState('networkidle');
  199 | 
  200 |   await portalPage.close();
  201 |   await popup.close();
  202 | 
  203 |   // Step 6: Reopen extension — should show "pro active", Subscribe disabled
  204 |   const popup2 = await openPopup(context);
  205 |   await popup2.getByText(UI_SETTINGS).click();
  206 |   await expect(popup2.getByText(UI_PRO_ACTIVE)).toBeVisible({ timeout: 5_000 });
  207 |   await expect(popup2.getByRole('button', { name: /Subscribed/ })).toBeDisabled();
  208 | 
  209 |   await popup2.close();
  210 | });
  211 | 
  212 | // ── TDD: Bug 1 — extension shows "pro inactive" after webhook fires ─────────
  213 | // RED now (shows "pro active"). GREEN after fix: worker deletes KV on cancel,
  214 | // extension detects 401 → auto-heals → check-subscription 404 → shows inactive.
  215 | 
  216 | test('[BUG 1 - TDD] After subscription.deleted webhook: extension shows pro inactive', async () => {
  217 |   await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  218 | 
  219 |   // Simulate webhook fired: token wiped from KV → validate-token 401 → check-subscription 404
  220 |   await context.route('**/validate-token',     route => route.fulfill({ status: 401 }));
  221 |   await context.route('**/check-subscription', route => route.fulfill({ status: 404 }));
  222 |   await removeStorage(context, ['subscriptionToken', 'subscriptionPlan']);
  223 | 
  224 |   const popup = await openPopup(context);
  225 |   await popup.getByText(UI_SETTINGS).click();
  226 |   await popup.locator('label', { hasText: UI_JOBFIT_PRO }).click();
  227 | 
  228 |   // Should show inactive — currently FAILS (shows "pro active")
  229 |   await expect(popup.getByText(UI_PRO_INACTIVE)).toBeVisible({ timeout: 5_000 });
  230 |   await expect(popup.getByRole('button', { name: /Subscribe →/ })).toBeEnabled();
  231 | 
  232 |   await popup.close();
  233 |   await context.unroute('**/validate-token');
  234 |   await context.unroute('**/check-subscription');
  235 | });
  236 | 
  237 | // ── TDD: Bug 2 — extension shows cancellation date when cancel_at_period_end ─
  238 | // RED now (shows plain "pro active"). GREEN after fix: validate-token returns
```