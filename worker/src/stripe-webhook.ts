import type { Env } from './index';
import { putSubscription, emailKey } from './validate-token';

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts     = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const sig       = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !sig) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signed    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected  = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('');
  return sig === expected;
}

async function sendTokenEmail(email: string, _token: string, resendKey: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from:    'JobFit <onboarding@resend.dev>',
      to:      email,
      subject: 'Welcome to JobFit Pro!',
      html: `
        <p>Thank you for subscribing to JobFit Pro!</p>
        <p>Your subscription is now active. Open the JobFit extension, go to <strong>Settings → JobFit Pro</strong> — it will activate automatically.</p>
        <p>You have <strong>120 analyses per day</strong>. Enjoy!</p>
      `,
    }),
  }).catch(() => {}); // fire and forget — don't fail the webhook if email fails
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const payload   = await request.text();
  const sigHeader = request.headers.get('stripe-signature') ?? '';

  if (!await verifyStripeSignature(payload, sigHeader, env.STRIPE_WEBHOOK_SECRET)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(payload); } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object;
    const customerDetails = session.customer_details as Record<string, unknown> | undefined;
    const email = (customerDetails?.email as string)
               ?? (session.customer_email as string)
               ?? '';
    const customerId = session.customer as string ?? '';
    const stripeId   = session.subscription as string ?? session.id as string;

    if (email) {
      const token = crypto.randomUUID();
      const today = new Date().toISOString().slice(0, 10);
      await putSubscription(token, { plan: 'pro', email, customerId, stripeId, dailyCount: 0, lastReset: today }, env);
      await env.SUBSCRIPTIONS.put(emailKey(email), token); // email index for auto-detect
      await sendTokenEmail(email, token, env.RESEND_API_KEY);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const stripeId = (event.data.object.id as string) ?? '';
    const list = await env.SUBSCRIPTIONS.list();
    await Promise.all(
      list.keys.map(async ({ name }) => {
        const raw = await env.SUBSCRIPTIONS.get(name);
        if (!raw) return;
        try {
          const sub = JSON.parse(raw) as { stripeId?: string; email?: string };
          if (sub.stripeId === stripeId) {
              await env.SUBSCRIPTIONS.delete(name);
              if (sub.email) await env.SUBSCRIPTIONS.delete(emailKey(sub.email));
            }
        } catch {}
      })
    );
  }

  return new Response('OK');
}
