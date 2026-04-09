export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    let email;
    try {
      ({ email } = await request.json());
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    if (!email) return new Response('Bad Request', { status: 400 });

    // Store email in KV — key includes timestamp to avoid duplicates
    await env.SIGNUPS.put(`${Date.now()}:${email}`, email);

    return new Response('OK', {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};
