import { handleSignup } from './signup';
import { handlePicker } from './picker';

export interface Env {
  SIGNUPS: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/signup') {
      return handleSignup(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/picker') {
      return handlePicker();
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
};
