import type { Env } from './index';

export interface Subscription {
  plan: 'pro';
  email: string;
  customerId: string;
  stripeId: string;
  dailyCount: number;
  lastReset: string; // YYYY-MM-DD
  cancelAt?: string; // YYYY-MM-DD, set when cancel_at_period_end=true
}

export function kvKey(token: string): string {
  return `token:${token}`;
}

export function emailKey(email: string): string {
  return `email:${email}`;
}

export async function getTokenByEmail(email: string, env: Env): Promise<string | null> {
  return env.SUBSCRIPTIONS.get(emailKey(email));
}

export async function getSubscription(token: string, env: Env): Promise<Subscription | null> {
  const raw = await env.SUBSCRIPTIONS.get(kvKey(token));
  if (!raw) return null;
  try { return JSON.parse(raw) as Subscription; } catch { return null; }
}

export async function putSubscription(token: string, sub: Subscription, env: Env): Promise<void> {
  await env.SUBSCRIPTIONS.put(kvKey(token), JSON.stringify(sub));
}

export async function handleValidateToken(request: Request, env: Env): Promise<Response> {
  let token: string | undefined;
  try { ({ token } = (await request.json()) as { token?: string }); } catch {
    return json({ error: 'Bad Request' }, 400);
  }
  if (!token) return json({ error: 'Missing token' }, 400);

  const sub = await getSubscription(token, env);
  if (!sub) return json({ error: 'Invalid token' }, 401);

  let cancelAt: string | undefined;
  if (sub.stripeId) {
    try {
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripeId}`, {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
      });
      if (res.ok) {
        const s = await res.json() as { cancel_at: number | null };
        if (s.cancel_at) cancelAt = new Date(s.cancel_at * 1000).toISOString().slice(0, 10);
      }
    } catch {} // never fail validation if Stripe is unreachable
  }

  return json({ plan: sub.plan, ...(cancelAt ? { cancelAt } : {}) });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
