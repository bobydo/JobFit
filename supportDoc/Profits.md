# JobFit — Pricing & Profit Model

## Pricing Tiers

| | **Starter — $5/mo** | **Pro — $15/mo** |
|---|---|---|
| Resumes | 1 | 2 |
| Limit type | 30 / month | 10 / day (resets daily) |
| Heavy day | capped at monthly pool | 5 jobs × 2 resumes |
| Monthly max if used daily | 30 | ~300 |

## Profit Per User / Month

| | **Starter — $5/mo** | **Pro — $15/mo** |
|---|---|---|
| Revenue | $5.00 | $15.00 |
| Groq cost (max usage) | ~$0.004 | ~$0.043 |
| Stripe fee (2.9% + $0.30) | ~$0.45 | ~$0.74 |
| Cloudflare Worker | $0 (free tier) | $0 (free tier) |
| **Profit per user/month** | **~$4.55** | **~$14.22** |

## At Scale (1,000 users)

| Mix | Monthly Profit |
|---|---|
| 700 Starter + 300 Pro | ~$7,451 |
| 500 Starter + 500 Pro | ~$9,385 |
| 300 Starter + 700 Pro | ~$11,319 |

## Notes

- Groq cost is negligible — Stripe's flat $0.30/transaction is the dominant cost, hitting Starter harder (9% of revenue vs 5% for Pro).
- Cloudflare Worker free tier supports up to 100,000 requests/day — covers ~10,000 Pro users at full daily usage.
- Daily limit enforced in Cloudflare Worker KV store; reset counter at midnight UTC per subscription token.
- Upgrade prompt: after Starter hits 30-analysis monthly cap, show *"Upgrade to Pro — daily refresh + 2 resumes."*

## LLM Modes

| Mode | Cost to user | Notes |
|---|---|---|
| JobFit Cloud (Starter) | $5/month | 1 resume, 30 analyses/month |
| JobFit Cloud (Pro) | $15/month | 2 resumes, 10 analyses/day |
| BYOK (Groq/Anthropic/OpenAI) | Free (user pays provider directly) | ~$0.01–$0.27/month at normal usage |
| Ollama (local) | Free | For testing only |
