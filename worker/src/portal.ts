import type { Env } from './index';
import { getSubscription, json } from './validate-token';

export async function handlePortalSession(request: Request, env: Env): Promise<Response> {
  let token: string | undefined;
  let returnUrl: string | undefined;
  try { ({ token, returnUrl } = (await request.json()) as { token?: string; returnUrl?: string }); }
  catch { return json({ error: 'Bad Request' }, 400); }

  if (!token) return json({ error: 'Missing token' }, 400);

  const sub = await getSubscription(token, env);
  if (!sub) return json({ error: 'Invalid token' }, 401);
  if (!sub.customerId) return json({ error: 'No customer ID on file — re-subscribe to enable portal' }, 400);

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
    body: new URLSearchParams({
      customer:   sub.customerId,
      return_url: returnUrl ?? 'https://jobfit-signup.baoshenyi.workers.dev',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: `Stripe portal error: ${err}` }, 502);
  }

  const { url } = await res.json() as { url: string };
  return json({ url });
}
