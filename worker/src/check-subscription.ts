import type { Env } from './index';
import { emailKey, getSubscription, json } from './validate-token';

export async function handleCheckSubscription(request: Request, env: Env): Promise<Response> {
  let email: string | undefined;
  try { ({ email } = (await request.json()) as { email?: string }); }
  catch { return json({ error: 'Bad Request' }, 400); }

  if (!email) return json({ error: 'Missing email' }, 400);

  const token = await env.SUBSCRIPTIONS.get(emailKey(email));
  if (!token) return json({ error: 'No subscription found' }, 404);

  const sub = await getSubscription(token, env);
  if (!sub) return json({ error: 'Subscription expired' }, 404);

  return json({ token, plan: sub.plan });
}
