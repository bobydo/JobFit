import type { OllamaMessage } from '../llm/ollama-provider';

export interface LangfuseConfig {
  host: string;
  publicKey: string;
  secretKey: string;
}

export interface LlmTrace {
  traceId: string;
  name: string;
  model: string;
  messages: OllamaMessage[];
  output: string;
  startTime: Date;
  endTime: Date;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, string>;
}

export async function traceLlmCall(
  config: LangfuseConfig,
  trace: LlmTrace,
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const auth = btoa(`${config.publicKey}:${config.secretKey}`);
    const host = config.host.replace(/\/$/, '');

    const res = await fetch(`${host}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        batch: [
          {
            id: crypto.randomUUID(),
            type: 'trace-create',
            timestamp: trace.startTime.toISOString(),
            body: {
              id: trace.traceId,
              name: trace.name,
              metadata: trace.metadata ?? {},
              timestamp: trace.startTime.toISOString(),
            },
          },
          {
            id: crypto.randomUUID(),
            type: 'generation-create',
            timestamp: trace.startTime.toISOString(),
            body: {
              id: crypto.randomUUID(),
              traceId: trace.traceId,
              name: trace.name,
              model: trace.model,
              input: trace.messages,
              output: trace.output,
              startTime: trace.startTime.toISOString(),
              endTime: trace.endTime.toISOString(),
              usage: {
                promptTokens: trace.promptTokens,
                completionTokens: trace.completionTokens,
                totalTokens: trace.promptTokens + trace.completionTokens,
              },
              metadata: trace.metadata ?? {},
            },
          },
        ],
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.warn('[JobFit] langfuse-tracer: non-OK response', res.status, body);
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    console.warn('[JobFit] langfuse-tracer: failed to send trace', e);
    return { ok: false, status: 0, body: String(e) };
  }
}
