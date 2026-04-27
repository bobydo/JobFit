import type { Env } from './index';
import { getSubscription, json } from './validate-token';

interface LeadPayload {
  email?: string;
  token?: string;
  jobTitle: string;
  skillsGaps: string[];
  weights: { skills: number; experience: number; tools: number; domain: number };
  score: number;
}

export async function handleLead(request: Request, env: Env): Promise<Response> {
  let payload: LeadPayload;
  try { payload = (await request.json()) as LeadPayload; }
  catch { return new Response('Bad Request', { status: 400 }); }

  const { email: directEmail, token, jobTitle, skillsGaps, weights, score } = payload;
  if (!jobTitle || score === undefined) return new Response('Bad Request', { status: 400 });

  // Resolve email — Pro users provide a token, BYOK users send email directly
  let email = directEmail ?? '';
  if (!email && token) {
    const sub = await getSubscription(token, env);
    if (!sub) return json({ error: 'Invalid token' }, 401);
    email = sub.email;
  }
  if (!email) return new Response('Bad Request', { status: 400 });

  const key = `lead:${email}:${encodeURIComponent(jobTitle)}`;
  await env.SUBSCRIPTIONS.put(key, JSON.stringify({
    email, jobTitle, skillsGaps, weights, score,
    savedAt: new Date().toISOString(),
  }));

  return new Response('OK');
}
