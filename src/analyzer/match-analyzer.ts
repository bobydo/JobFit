import { ollamaChat } from '../llm/ollama-provider';
import { fetchJobPage } from '@utils/job-page-fetcher';
import type { Resume, JobEmail, AnalysisResult } from '../popup/types';

interface LLMResponse {
  matchScore: number;
  matchSummary: string;
  skillsGaps: string[];
}

function buildPrompt(resume: Resume, job: JobEmail): string {
  const resumeText = resume.body.trim().slice(0, 3000);
  const jobText = job.body.trim().slice(0, 3000);
  return [
    `Resume: ${resume.subject}`,
    resumeText,
    '',
    `Job: ${job.subject}`,
    jobText,
    '',
    'Reply ONLY with valid JSON — no markdown, no explanation:',
    '{"matchScore": <0-100>, "matchSummary": "<2-3 sentences>", "skillsGaps": ["<gap1>", "<gap2>"]}',
  ].join('\n');
}

function parseResponse(raw: string): LLMResponse {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try extracting first JSON object from the string
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in LLM response');
    parsed = JSON.parse(match[0]);
  }

  const obj = parsed as Record<string, unknown>;
  const matchScore = typeof obj.matchScore === 'number'
    ? Math.min(100, Math.max(0, Math.round(obj.matchScore)))
    : 0;
  const matchSummary = typeof obj.matchSummary === 'string' ? obj.matchSummary : 'No summary provided.';
  const skillsGaps = Array.isArray(obj.skillsGaps)
    ? (obj.skillsGaps as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  return { matchScore, matchSummary, skillsGaps };
}

export async function analyzePair(
  resume: Resume,
  job: JobEmail,
  ollamaBaseUrl: string,
  ollamaModel: string
): Promise<AnalysisResult> {
  const userPrompt = buildPrompt(resume, job);
  const raw = await ollamaChat({
    baseUrl: ollamaBaseUrl,
    model: ollamaModel,
    messages: [
      { role: 'system', content: 'You are a professional career advisor. Evaluate how well a candidate\'s resume matches a job posting. Be concise and honest.' },
      { role: 'user', content: userPrompt },
    ],
  });

  const { matchScore, matchSummary, skillsGaps } = parseResponse(raw);

  return {
    jobEmailId: job.id,
    jobSubject: job.subject,
    jobUrl: job.urls[0] ?? '',
    resumeId: resume.id,
    resumeSubject: resume.subject,
    matchScore,
    matchSummary,
    skillsGaps,
    analyzedAt: new Date(),
  };
}

// Returns null if the URL is not a real job posting page
export async function analyzeUrl(
  resume: Resume,
  url: string,
  emailId: string,
  ollamaBaseUrl: string,
  ollamaModel: string
): Promise<AnalysisResult | null> {
  const page = await fetchJobPage(url);
  if (!page) return null;
  const fakeJob: JobEmail = { id: emailId, subject: page.title, body: page.body, urls: [url], date: new Date() };
  return analyzePair(resume, fakeJob, ollamaBaseUrl, ollamaModel);
}
