# JobFit Email Collection Setup

Silently collects the user's Gmail email when they first open the extension and stores it in Cloudflare KV — no form shown to the user.

---

## Names & URLs

| Item | Value |
|------|-------|
| Cloudflare Worker name | `jobfit-signup` |
| Worker URL | `https://jobfit-signup.baoshenyi.workers.dev` |
| KV namespace name | `SIGNUPS` |
| KV binding variable | `SIGNUPS` |
| Cloudflare dashboard | `https://dash.cloudflare.com` |

---

## How It Works

1. User opens the JobFit extension for the first time (after Gmail labels are confirmed ready)
2. Extension fetches the user's Gmail address via `getGmailProfile()`
3. Extension POSTs `{ email }` to the Cloudflare Worker at `/signup`
4. Worker stores the email in KV with a timestamp key: `1234567890:email@gmail.com`
5. `emailSignupShown: true` is saved to Chrome storage so this only runs once per user

---

## Files Changed

| File | Change |
|------|--------|
| `src/config.ts` | Set `WORKER_URL = 'https://jobfit-signup.baoshenyi.workers.dev'` |
| `src/popup/components/App.tsx` | Removed signup UI, added silent fetch to worker |
| `worker/index.js` | Cloudflare Worker — receives email, stores in KV |

---

## Cloudflare Dashboard Steps (already done)

1. **Create Worker**
   - Workers & Pages → Create application → Start with Hello World
   - Name: `jobfit-signup`
   - Edit code → paste `worker/index.js` → Save and deploy

2. **Create KV Namespace**
   - Storage & databases → KV → Create namespace
   - Name: `SIGNUPS`

3. **Bind KV to Worker**
   - Workers & Pages → `jobfit-signup` → Bindings → Add binding
   - Type: KV Namespace
   - Variable name: `SIGNUPS`
   - KV Namespace: `SIGNUPS`

---

## Viewing Collected Emails

Cloudflare dashboard → **Storage & databases** → **KV** → **SIGNUPS** → **KV Pairs** tab

Each entry:
- **Key:** `{timestamp}:{email}` e.g. `1775693296671:user@gmail.com`
- **Value:** the email address

---

## Testing

```powershell
Invoke-RestMethod -Uri "https://jobfit-signup.baoshenyi.workers.dev/signup" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com"}'
# Expected response: OK
```

Then check KV Pairs — the email should appear within seconds.
