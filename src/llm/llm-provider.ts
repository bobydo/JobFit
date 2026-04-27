export interface LLMChatResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  startTime: Date;
  endTime: Date;
}

export type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface LLMProvider {
  chat(messages: LLMMessage[]): Promise<LLMChatResult>;
}
