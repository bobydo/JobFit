import type { Env } from './index';
import { getSubscription } from './validate-token';

interface HistoryPayload {
  email?: string;
  token?: string;
  job_id: string;
  job_title: string;
  job_url: string;
  score: number;
  skills_gap: Array<{ skill: string; priority: 'required' | 'preferred' }>;
}

export async function handleHistory(request: Request, env: Env): Promise<Response> {
  let payload: HistoryPayload;
  try { payload = (await request.json()) as HistoryPayload; }
  catch { return new Response('Bad Request', { status: 400 }); }

  const { email: directEmail, token, job_id, job_title, job_url, score, skills_gap } = payload;
  if (!job_id || score === undefined) return new Response('Bad Request', { status: 400 });

  let email = directEmail ?? '';
  if (!email && token) {
    const sub = await getSubscription(token, env);
    if (!sub) return new Response('Unauthorized', { status: 401 });
    email = sub.email;
  }
  if (!email) return new Response('Bad Request', { status: 400 });

  const now = new Date().toISOString();
  const gapJson = JSON.stringify(skills_gap ?? []);

  await env.DB.prepare(`
    INSERT INTO job_history (email, job_id, job_title, job_url, best_score, skills_gap, last_analyzed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (email, job_id) DO UPDATE SET
      best_score    = CASE WHEN excluded.best_score > best_score THEN excluded.best_score ELSE best_score END,
      skills_gap    = CASE WHEN excluded.best_score > best_score THEN excluded.skills_gap ELSE skills_gap END,
      last_analyzed = CASE WHEN excluded.best_score > best_score THEN excluded.last_analyzed ELSE last_analyzed END
  `).bind(email, job_id, job_title, job_url, score, gapJson, now).run();

  return new Response('OK', { status: 200 });
}
