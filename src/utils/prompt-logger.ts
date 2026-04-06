import type { OllamaMessage } from '../llm/ollama-provider';

export interface PromptLog {
  timestamp: string;
  jobId: string;
  resumeSubject: string;
  jobSubject: string;
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

export function savePromptLog(log: PromptLog, saveFolder: string): void {
  try {
    const json = JSON.stringify(log, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const ts = log.timestamp.replace(/[:.]/g, '-');
    const safeJob = log.jobId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
    const filename = `${saveFolder}/logs/${ts}-${safeJob}.json`;
    chrome.downloads.download({ url, filename, saveAs: false }, () => {
      URL.revokeObjectURL(url);
    });
  } catch (e) {
    console.warn('[JobFit] prompt-logger: failed to save log', e);
  }
}
