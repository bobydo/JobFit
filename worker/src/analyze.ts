import type { Env } from './index';
import { getSubscription, putSubscription, json } from './validate-token';

const MODEL = 'gpt-4o-mini';

interface LLMMessage { role: 'system' | 'user' | 'assistant'; content: string; }

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function handleAnalyze(request: Request, env: Env): Promise<Response> {
  let token: string | undefined;
  let messages: LLMMessage[] | undefined;
  try {
    ({ token, messages } = (await request.json()) as { token?: string; messages?: LLMMessage[] });
  } catch { return json({ error: 'Bad Request' }, 400); }

  if (!token || !messages?.length) return json({ error: 'Missing token or messages' }, 400);

  // ── Validate token ────────────────────────────────────────────────────────
  const sub = await getSubscription(token, env);
  if (!sub) return json({ error: 'Invalid token' }, 401);

  // ── Server-side daily quota ───────────────────────────────────────────────
  const dailyLimit = parseInt(env.DAILY_LIMIT ?? '120', 10);
  const today = todayUtc();
  const count = sub.lastReset === today ? sub.dailyCount : 0;
  if (count >= dailyLimit) {
    return json({ error: `Daily limit reached (${dailyLimit}/day). Resets at midnight UTC.` }, 429);
  }

  // Increment before calling LLM — prevents race-condition double-use
  await putSubscription(token, { ...sub, dailyCount: count + 1, lastReset: today }, env);

  // ── Call GPT-4o mini ──────────────────────────────────────────────────────
  const startMs = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    // Roll back count on OpenAI failure so user isn't penalised
    await putSubscription(token, { ...sub, dailyCount: count, lastReset: today }, env);
    return json({ error: `LLM error ${res.status}: ${err}` }, 502);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return json({
    content:          data.choices[0]?.message?.content ?? '',
    promptTokens:     data.usage?.prompt_tokens     ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    latencyMs:        Date.now() - startMs,
  });
}
