import { describe, it, expect } from 'vitest';
import { traceLlmCall } from './langfuse-tracer';
import { LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, DEV_MODE } from '../config';

const NOW = new Date();
const ONE_SEC_LATER = new Date(NOW.getTime() + 1000);

describe('langfuse-tracer — live integration', () => {
  it.skipIf(!DEV_MODE)('sends a minimal trace and gets HTTP 207 from Langfuse', async () => {
    const traceId = crypto.randomUUID();
    const result = await traceLlmCall(
      {
        host: LANGFUSE_BASE_URL,
        publicKey: LANGFUSE_PUBLIC_KEY,
        secretKey: LANGFUSE_SECRET_KEY,
      },
      {
        traceId,
        name: 'test-diagnostic-trace',
        model: 'test-model',
        messages: [
          { role: 'user', content: 'Hello, this is a diagnostic test.' },
        ],
        output: '{"matchScore": 42}',
        startTime: NOW,
        endTime: ONE_SEC_LATER,
        promptTokens: 10,
        completionTokens: 5,
        metadata: { source: 'vitest-diagnostic' },
      }
    );

    console.log('\n══════════════ Langfuse Response ══════════════');
    console.log('Status :', result.status);
    console.log('OK     :', result.ok);
    console.log('Body   :', result.body);

    expect(result.ok).toBe(true);

    // wait a bit (ingestion delay)
    await new Promise(r => setTimeout(r, 6000));

    const auth = `Basic ${btoa(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`)}`;

    // list recent traces and confirm ours appears
    const listRes = await fetch(`${LANGFUSE_BASE_URL}/api/public/traces?limit=10`, {
      headers: { Authorization: auth },
    });
    const listJson = await listRes.json() as { data: { id: string }[] };
    const found = listJson.data.some((t) => t.id === traceId);
    console.log('\n── GET traces list ──');
    console.log('Status:', listRes.status);
    console.log('Found traceId in list:', found);
    console.log('Recent IDs:', listJson.data.map((t) => t.id));

    expect(listRes.status).toBe(200);
    expect(found).toBe(true);
  }, 10_000);
});
