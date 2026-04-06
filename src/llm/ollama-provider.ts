export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatOptions {
  baseUrl: string;
  model: string;
  messages: OllamaMessage[];
}

export interface OllamaChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  startTime: Date;
  endTime: Date;
}

export async function ollamaChat(options: OllamaChatOptions): Promise<OllamaChatResult> {
  const { baseUrl, model, messages } = options;
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

  const startTime = new Date();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0 } }),
  });
  const endTime = new Date();

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content: string = json?.message?.content ?? '';
  if (!content) throw new Error('Ollama returned empty content');

  return {
    content,
    promptTokens: json?.prompt_eval_count ?? 0,
    completionTokens: json?.eval_count ?? 0,
    latencyMs: endTime.getTime() - startTime.getTime(),
    startTime,
    endTime,
  };
}

export async function ollamaHealthCheck(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
