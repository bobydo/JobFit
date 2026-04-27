# JobFit Worker — Operations

## Your accounts (always sign in, never create new)
- Gmail:      baoshenyi@gmail.com
- Cloudflare: https://dash.cloudflare.com/e6f74de28b7ee985e010db5b9aa93162
- Stripe:     https://dashboard.stripe.com (test mode: https://dashboard.stripe.com/test/dashboard)
- Resend:     https://resend.com
- OpenAI:     https://platform.openai.com


## Worker
- Live URL:   https://jobfit-signup.baoshenyi.workers.dev
- Deploy:     cd d:/JobFit/worker && npx wrangler deploy
- Live logs:  npx wrangler tail

Endpoints (all POST unless noted):
- https://jobfit-signup.baoshenyi.workers.dev/signup
- https://jobfit-signup.baoshenyi.workers.dev/picker  (GET)
- https://jobfit-signup.baoshenyi.workers.dev/validate-token
- https://jobfit-signup.baoshenyi.workers.dev/check-subscription
- https://jobfit-signup.baoshenyi.workers.dev/webhook
- https://jobfit-signup.baoshenyi.workers.dev/analyze
- https://jobfit-signup.baoshenyi.workers.dev/create-portal-session
- https://jobfit-signup.baoshenyi.workers.dev/lead


## Cloudflare KV
- Dashboard:        https://dash.cloudflare.com/e6f74de28b7ee985e010db5b9aa93162/workers/kv/namespaces
- SIGNUPS ID:       55b9809c9a724f1a9aa850059f056605
- SUBSCRIPTIONS ID: 0d55b4cbce5e45c094d4208184ba6e73

Commands:
- npx wrangler kv key list --binding SUBSCRIPTIONS
- npx wrangler kv key get --binding SUBSCRIPTIONS "token:uuid-here"
- npx wrangler kv key delete --binding SUBSCRIPTIONS "token:uuid-here"


## Secrets (run once per environment, never commit to code)
- npx wrangler secret put STRIPE_WEBHOOK_SECRET
- npx wrangler secret put STRIPE_SECRET_KEY
- npx wrangler secret put OPENAI_API_KEY
- npx wrangler secret put RESEND_API_KEY

For live: add --env production to each command

Configurable without secret (edit wrangler.toml then redeploy):
- DAILY_LIMIT = 120   (analyses per day per Pro user)


## Stripe (test)
- Dashboard:       https://dashboard.stripe.com/test/dashboard
- Products:        https://dashboard.stripe.com/test/products
- Payment links:   https://dashboard.stripe.com/test/payment-links
- Webhooks:        https://dashboard.stripe.com/test/workbench/webhooks
- Customer portal: https://dashboard.stripe.com/test/settings/billing/portal

Webhook destination URL: https://jobfit-signup.baoshenyi.workers.dev/webhook
Webhook events (select all 3):
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted


## Resend
- Dashboard:   https://resend.com/emails
- API keys:    https://resend.com/api-keys
- Test sender: onboarding@resend.dev (no domain verification needed for testing)
- Daily limit: 100 emails/day on free plan


## First-time setup sequence (test mode, run in order)

1.  Sign in Stripe (test mode) → Products → create "JobFit Pro" $11 CAD/month recurring
2.  Payment Links → create link for JobFit Pro → paste URL into d:/JobFit/.env as VITE_STRIPE_PRO_URL
3.  Settings → Billing → Customer portal → Activate test link → Cancellations: end of billing period
4.  Workbench → Webhooks → Add destination → URL: https://jobfit-signup.baoshenyi.workers.dev/webhook → select 3 events above
5.  Copy signing secret (whsec_...) → npx wrangler secret put STRIPE_WEBHOOK_SECRET
6.  Stripe → Developers → API keys → reveal Secret key (sk_test_...) → npx wrangler secret put STRIPE_SECRET_KEY
7.  Sign in Resend → API Keys → create key → npx wrangler secret put RESEND_API_KEY
8.  Sign in OpenAI → API keys → create key → npx wrangler secret put OPENAI_API_KEY
9.  Sign in Cloudflare KV → confirm SUBSCRIPTIONS namespace ID is in wrangler.toml
10. npx wrangler deploy
11. npm run build (extension) → reload unpacked in Chrome


## Automatic flow (no action needed after setup)

User subscribes:
- Stripe fires checkout.session.completed
- Worker saves token in KV (token:{uuid} + email:{email})
- Worker sends confirmation email via Resend
- Extension auto-detects via /check-subscription using baoshenyi@gmail.com → activates Pro

User cancels in portal:
- Stripe fires customer.subscription.updated
- Worker deletes token from KV
- Extension shows "Pro inactive" on next Settings open

Subscription period ends:
- Stripe fires customer.subscription.deleted
- Worker removes any remaining KV entries


## Health checks (run when something looks wrong)

- npx wrangler tail                                                                    (live Worker logs)
- npx wrangler kv key list --binding SUBSCRIPTIONS                                    (active tokens)
- https://dashboard.stripe.com/test/workbench/webhooks                                (webhook delivery status)
- https://resend.com/emails                                                            (sent emails)
- https://dash.cloudflare.com/e6f74de28b7ee985e010db5b9aa93162/workers/kv/namespaces  (KV data)
