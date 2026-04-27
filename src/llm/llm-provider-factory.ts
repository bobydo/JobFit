import type { AppConfig } from '../storage/config-store';
import type { LLMProvider } from './llm-provider';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import { OllamaProvider } from './ollama-provider';
import { JobfitCloudProvider } from './jobfit-cloud-provider';
import { OLLAMA_MODEL, OLLAMA_BASE_URL } from '../config';

export class LLMProviderFactory {
  create(config: AppConfig): LLMProvider {
    switch (config.mode) {
      case 'groq':
      case 'openai':
        return new OpenAICompatibleProvider(config.mode, config.apiKey!);

      case 'anthropic':
        return new AnthropicProvider(config.apiKey!);

      case 'ollama':
        return new OllamaProvider(
          config.ollamaBaseUrl ?? OLLAMA_BASE_URL,
          config.ollamaModel   ?? OLLAMA_MODEL,
        );

      case 'jobfit-cloud':
        return new JobfitCloudProvider(config.subscriptionToken!);

      default:
        throw new Error(`Unknown LLM mode: ${config.mode}`);
    }
  }
}
