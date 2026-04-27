import type { Env } from './index';

export interface Subscription {
  plan: 'pro';
  email: string;
  stripeId: string;
  dailyCount: number;
  lastReset: string; // YYYY-MM-DD
}

export function kvKey(token: string): string {
  return `token:${token}`;
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

  return json({ plan: sub.plan });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
