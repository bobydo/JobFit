import type { AnalysisWeights } from '../popup/types';

export interface LLMResponse {
  matchScore: number;
  matchSummary: string;
  matchedSkills: string[];
  skillsGaps: string[];
  weights: AnalysisWeights;
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
      ? Math.min(100, Math.max(0, Math.round(obj.matchScore))) : 0;

    const matchSummary = typeof obj.matchSummary === 'string'
      ? obj.matchSummary : 'No summary provided.';

    const matchedSkills = Array.isArray(obj.matchedSkills)
      ? (obj.matchedSkills as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    const skillsGaps = Array.isArray(obj.skillsGaps)
      ? (obj.skillsGaps as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    const w = obj.weights as Record<string, unknown> | undefined;
    const weights: AnalysisWeights = {
      skills:     typeof w?.skills     === 'number' ? Math.round(w.skills)     : 25,
      experience: typeof w?.experience === 'number' ? Math.round(w.experience) : 25,
      tools:      typeof w?.tools      === 'number' ? Math.round(w.tools)      : 25,
      domain:     typeof w?.domain     === 'number' ? Math.round(w.domain)     : 25,
    };

    return { matchScore, matchSummary, matchedSkills, skillsGaps, weights };
  }
}
