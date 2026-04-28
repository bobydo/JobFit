# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: payment.test.ts >> [BUG 2 - TDD] When cancel_at_period_end=true: extension shows cancellation date
- Location: e2e\payment.test.ts:241:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Cancels/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/Cancels/i)

```

# Test source

```ts
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
  239 | // cancelAt date, extension surfaces "Cancels <date>" warning in Settings.
  240 | 
  241 | test('[BUG 2 - TDD] When cancel_at_period_end=true: extension shows cancellation date', async () => {
  242 |   await setStorage(context, { subscriptionToken: TEST_TOKEN, subscriptionPlan: TEST_PLAN, mode: TEST_MODE });
  243 | 
  244 |   // Simulate worker returning cancelAt alongside the active plan
  245 |   await context.route('**/validate-token', route =>
  246 |     route.fulfill({
  247 |       status: 200, contentType: 'application/json',
  248 |       body: JSON.stringify({ plan: TEST_PLAN, cancelAt: '2026-05-28' }),
  249 |     })
  250 |   );
  251 | 
  252 |   const popup = await openPopup(context);
  253 |   await popup.getByText(UI_SETTINGS).click();
  254 | 
  255 |   // Should show cancellation warning — currently FAILS (extension ignores cancelAt)
> 256 |   await expect(popup.getByText(new RegExp(UI_CANCELS_LABEL, 'i'))).toBeVisible({ timeout: 5_000 });
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  257 | 
  258 |   await popup.close();
  259 |   await context.unroute('**/validate-token');
  260 | });
  261 | 
```