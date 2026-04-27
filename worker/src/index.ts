import { handleSignup }         from './signup';
import { handlePicker }         from './picker';
import { handleValidateToken }  from './validate-token';
import { handleStripeWebhook }  from './stripe-webhook';
import { handleAnalyze }        from './analyze';
import { handleLead }           from './lead';

export interface Env {
  SIGNUPS:               KVNamespace;
  SUBSCRIPTIONS:         KVNamespace;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_API_KEY:        string;
  RESEND_API_KEY:        string;
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const { pathname } = new URL(request.url);
    const isPost = request.method === 'POST';
    const isGet  = request.method === 'GET';

    if (isPost && pathname === '/signup')         return handleSignup(request, env);
    if (isGet  && pathname === '/picker')         return handlePicker();
    if (isPost && pathname === '/validate-token') return handleValidateToken(request, env);
    if (isPost && pathname === '/webhook')        return handleStripeWebhook(request, env);
    if (isPost && pathname === '/analyze')        return handleAnalyze(request, env);
    if (isPost && pathname === '/lead')           return handleLead(request, env);

    return new Response('Not Found', { status: 404 });
  },
};
