export interface LLMResponse {
  matchScore: number;
  matchSummary: string;
  skillsGaps: string[];
}

export class AnalysisResponseParser {
  parse(raw: string): LLMResponse {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in LLM response');
      parsed = JSON.parse(match[0]);
    }

    const obj = parsed as Record<string, unknown>;
    const matchScore = typeof obj.matchScore === 'number'
      ? Math.min(100, Math.max(0, Math.round(obj.matchScore)))
      : 0;
    const matchSummary = typeof obj.matchSummary === 'string'
      ? obj.matchSummary
      : 'No summary provided.';
    const skillsGaps = Array.isArray(obj.skillsGaps)
      ? (obj.skillsGaps as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    return { matchScore, matchSummary, skillsGaps };
  }
}
