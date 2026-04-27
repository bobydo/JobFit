import type { AppConfig } from '../storage/config-store';
import type { LLMChatResult, LLMMessage } from './llm-provider';
import { LLMProviderFactory } from './llm-provider-factory';

export type { LLMChatResult, LLMMessage };

const _factory = new LLMProviderFactory();

export async function llmChat(config: AppConfig, messages: LLMMessage[]): Promise<LLMChatResult> {
  return _factory.create(config).chat(messages);
}
