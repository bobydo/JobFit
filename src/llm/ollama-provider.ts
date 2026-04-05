export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatOptions {
  baseUrl: string;
  model: string;
  messages: OllamaMessage[];
}

export async function ollamaChat(options: OllamaChatOptions): Promise<string> {
  const { baseUrl, model, messages } = options;
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content: string = json?.message?.content ?? '';
  if (!content) throw new Error('Ollama returned empty content');
  return content;
}

export async function ollamaHealthCheck(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
