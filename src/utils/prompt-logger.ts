import type { OllamaMessage } from '../llm/ollama-provider';

export interface PromptLog {
  timestamp: string;
  jobId: string;
  resumeSubject: string;
  jobSubject: string;
  jobBody: string;
  model: string;
  messages: OllamaMessage[];
  rawResponse: string;
  parsedResult: {
    matchScore: number;
    matchSummary: string;
    skillsGaps: string[];
  };
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

// Log saving is intentionally suppressed — auto-downloading files during analysis
// spams Chrome's download notification and covers the Results UI.
// To re-enable, restore the chrome.downloads.download call here.
export function savePromptLog(_log: PromptLog, _saveFolder: string): void {
  // no-op
}
