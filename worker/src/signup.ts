import type { Env } from './index';

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  let email: string | undefined;
  try {
    ({ email } = (await request.json()) as { email?: string });
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  if (!email) return new Response('Bad Request', { status: 400 });

  await env.SIGNUPS.put(`${Date.now()}:${email}`, email);

  return new Response('OK', {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
