# JobFit Pro — Payment, Token & Cancellation Reference

## How the token system works (end to end)

```
1. Subscribe
   User clicks Subscribe → Stripe checkout → payment succeeds
   → Stripe fires checkout.session.completed webhook
   → worker/src/stripe-webhook.ts:
       generates crypto.randomUUID() as token
       SUBSCRIPTIONS KV: token:{uuid}  → { plan, email, customerId, stripeId, dailyCount, lastReset }
       SUBSCRIPTIONS KV: email:{email} → {uuid}   ← index for email-based auto-detect
       sends welcome email (token NOT in email — auto-detected instead)

2. Extension detects subscription
   Settings panel opens
   → if chrome.storage has NO token:
       POST /check-subscription { email }
       → 200: saves token + plan to chrome.storage → shows "pro active"
       → 404: shows "Pro inactive"
   → if chrome.storage HAS token:
       POST /validate-token { token }
       → 200: shows "pro active"
       → 401/404: wipes token, immediately retries /check-subscription by email (auto-heal)
       → 500 or network error: keeps token, shows "pro active" (never wipe on server errors)

3. Analyze (Pro)
   Extension sends token to POST /analyze
   → worker validates token → checks/resets daily quota → calls OpenAI → returns result

4. Manage subscription
   Click "Manage subscription →"
   → extension sends token to POST /create-portal-session { token, returnUrl }
   → worker looks up customerId from KV → creates Stripe Customer Portal URL
   → opens in browser tab

5. Cancel subscription
   User clicks Cancel in Stripe portal
   → Stripe fires customer.subscription.deleted at end of billing period
   → worker deletes token:{uuid} and email:{email} from KV
   → next Settings open: validate-token → 401 → auto-heal → check-subscription → 404 → "Pro inactive"
```

---

## Correct configuration (definitive)

| What | Correct value | Why |
|---|---|---|
| Stripe portal → Cancellations | **Cancel at end of billing period** | User keeps access through paid period |
| Worker secrets | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OPENAI_API_KEY, RESEND_API_KEY | Set via `npx wrangler secret put <NAME>` |
| chrome.storage keys | `subscriptionToken`, `subscriptionPlan`, `mode` | Auto-managed — do not edit manually |
| Stripe webhook events | `checkout.session.completed`, `customer.subscription.deleted` | Only these two needed |

---

## What broke before and what is fixed now

| Problem | Root cause | Fix applied |
|---|---|---|
| Token wiped on deployment restart or 500 error | Any non-2xx cleared token from storage | Now only 401/404 clears token; 5xx keeps it |
| "Invalid token" on Manage Subscription after redeploy | Stale token in storage blocked auto-detect | On 401/404, auto-retries `/check-subscription` by email before showing "inactive" |
| Pro access revoked the moment user clicked Cancel | `customer.subscription.updated` with `cancel_at_period_end: true` deleted token immediately | Removed that handler — only `customer.subscription.deleted` deletes the token now |

---

## Manual recovery (if token is truly lost)

**Option A — resend the Stripe webhook (preferred):**
```
Stripe Dashboard → Developers → Webhooks → your endpoint
→ Recent deliveries → find checkout.session.completed → Resend
→ reopen extension Settings — auto-detect finds the new token within ~10 seconds
```

**Option B — clear stale token via DevTools:**
```
Open extension popup → F12 → Console tab:
chrome.storage.sync.remove(['subscriptionToken', 'subscriptionPlan'], () => console.log('done'))
→ close and reopen Settings → auto-detect runs
```

---

## Test process (sandbox / test mode)

```
[ ] Subscribe
    Card: 4242 4242 4242 4242 · any future date · any CVC
    → Settings opens → "pro active" appears within ~10 seconds
    → Cloudflare KV SUBSCRIPTIONS: token:{uuid} and email:{baoshenyi@gmail.com} keys exist

[ ] Analyze (Pro features)
    → Results show role weighting (skills/experience/tools/domain %)
    → Skill gaps show "required" (red) and "preferred" (grey) labels
    → D1 job_history: row written if score ≥ 85

[ ] Manage subscription
    → Click "Manage subscription →" in Settings
    → Stripe Customer Portal opens showing invoice history + Cancel button

[ ] Cancel (end of period)
    → Click Cancel in portal → choose "Cancel at end of billing period"
    → Settings still shows "pro active" (access kept through paid period)
    → After Stripe fires subscription.deleted: Settings shows "Pro inactive"

[ ] Token auto-recovery
    → Run in DevTools console:
       chrome.storage.sync.remove(['subscriptionToken', 'subscriptionPlan'], () => {})
    → Reopen Settings → "pro active" restored within ~5 seconds (auto-heal)

[ ] Re-subscribe after cancellation
    → Click Subscribe → checkout → pay
    → Stripe resends checkout.session.completed → new token created in KV
    → Settings auto-detects → "pro active"
```
