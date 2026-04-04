# JobFit — Pricing & Profit Model

## Pricing Tier

| | **Pro — $11/mo** |
|---|---|
| Resumes | 2 |
| Limit type | 50 / day (resets daily) |
| Heavy day | 50 jobs × 2 resumes |
| Monthly max LLM calls | ~3,000 |

## Profit Per User / Month

| | **Pro — $11/mo** |
|---|---|
| Revenue | $11.00 |
| Groq cost (max usage) | ~$0.22 |
| Stripe fee (2.9% + $0.30) | ~$0.62 |
| Cloudflare Worker | $0 (free tier) |
| **Profit per user/month** | **~$10.16** |

## At Scale (1,000 users)

| Users | Monthly Profit |
|---|---|
| 500 Pro | ~$5,080 |
| 1,000 Pro | ~$10,160 |
| 2,000 Pro | ~$20,320 |

## Notes

- Groq cost at 50/day: ~$0.22/user/month — negligible vs Stripe's flat $0.30.
- Cloudflare Worker free tier: 100,000 requests/day → covers ~1,000 Pro users at full daily usage (50 jobs × 2 resumes = 100 requests/user/day). Beyond that, Worker paid plan at $5/mo covers 10M requests/month.
- Daily limit enforced in Cloudflare Worker KV store; reset counter at midnight UTC per subscription token.

## LLM Modes

| Mode | Cost to user | Notes |
|---|---|---|
| JobFit Cloud (Pro) | $11/month | 2 resumes, 50 analyses/day |
| BYOK (Groq/Anthropic/OpenAI) | Free (user pays provider directly) | ~$0.01–$0.27/month at normal usage |
| Ollama (local) | Free | For testing only |
