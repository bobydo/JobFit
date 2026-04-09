import { llmChat } from '../llm/llm-router';
import { fetchJobPage, fetchJobPageViaTab } from '@utils/job-page-fetcher';
import { savePromptLog } from '@utils/prompt-logger';
import { traceLlmCall } from '@utils/langfuse-tracer';
import {
  LANGFUSE_ENABLED, LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
  DAILY_ANALYSIS_LIMIT,
  GROQ_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL, ANTHROPIC_DEFAULT_MODEL,
  OLLAMA_MODEL,
} from '../config';
import { getDailyCount, incrementDailyCount } from '../storage/cache-store';
import type { Resume, JobEmail, AnalysisResult } from '../popup/types';
import type { AppConfig } from '../storage/config-store';

interface LLMResponse {
  matchScore: number;
  matchSummary: string;
  skillsGaps: string[];
}

function getModelName(config: AppConfig): string {
  switch (config.mode) {
    case 'groq':      return GROQ_DEFAULT_MODEL;
    case 'openai':    return OPENAI_DEFAULT_MODEL;
    case 'anthropic': return ANTHROPIC_DEFAULT_MODEL;
    case 'ollama':    return config.ollamaModel ?? OLLAMA_MODEL;
    default:          return config.mode;
  }
}

function buildPrompt(resume: Resume, job: JobEmail): string {
  const resumeText = resume.body.trim().slice(0, 6000);
  const jobText = job.body.trim().slice(0, 4000);
  return [
    `Resume (${resume.subject}):`,
    resumeText,
    '',
    `Job posting (${job.subject}):`,
    jobText,
    '',
    'Scoring rules:',
    '- Score 0–100 reflecting overall fit.',
    '- Hard missing requirements (named technology + required years) reduce the score significantly.',
    '- Genuine transferable skills (architecture, AI/LLM, CI/CD, system integration) count toward the score.',
    '- Do NOT apply a hard cap — balance gaps against real strengths.',
    '',
    'skillsGaps: list the specific skills or experiences THIS candidate is missing for THIS role, framed as actionable items (e.g. "Learn Kotlin and Android SDK — 5+ years required, no Android experience on resume"). Be specific to the candidate\'s background, not generic job requirements.',
    '',
    'Reply ONLY with valid JSON — no markdown, no explanation:',
    '{"matchScore": <0-100>, "matchSummary": "<5-6 sentences>", "skillsGaps": ["<gap1>", "<gap2>", "<gap3>", "<gap4>", "<gap5>", "<gap6>"]}',
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
  config: AppConfig
): Promise<AnalysisResult> {
  const systemMessage = { role: 'system' as const, content: 'You are a professional career advisor. Evaluate how well a candidate\'s resume matches a job posting. Be concise and honest.' };
  const userMessage = { role: 'user' as const, content: buildPrompt(resume, job) };
  const messages = [systemMessage, userMessage];

  const count = await getDailyCount();
  if (count >= DAILY_ANALYSIS_LIMIT) {
    const resetTime = new Date();
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);
    const hh = resetTime.getHours().toString().padStart(2, '0');
    const mm = resetTime.getMinutes().toString().padStart(2, '0');
    throw new Error(
      `Daily limit reached — you've used ${count}/${DAILY_ANALYSIS_LIMIT} analyses today. ` +
      `Resets at midnight (${hh}:${mm} local time).`
    );
  }
  await incrementDailyCount();

  const result = await llmChat(config, messages);
  const { matchScore, matchSummary, skillsGaps } = parseResponse(result.content);
  const model = getModelName(config);

  // Save prompt log as JSON to Downloads/saveFolder/logs/
  savePromptLog({
    timestamp: result.startTime.toISOString(),
    jobId: job.id,
    resumeSubject: resume.subject,
    jobSubject: job.subject,
    jobBody: job.body,
    model,
    messages,
    rawResponse: result.content,
    parsedResult: { matchScore, matchSummary, skillsGaps },
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    latencyMs: result.latencyMs,
  }, config.saveFolder);

  // Send trace to Langfuse if enabled (build-time flag AND runtime toggle)
  const lfHost   = config.langfuseHost      || LANGFUSE_BASE_URL;
  const lfPubKey = config.langfusePublicKey || LANGFUSE_PUBLIC_KEY;
  const lfSecKey = config.langfuseSecretKey || LANGFUSE_SECRET_KEY;

  if (LANGFUSE_ENABLED && (config.langfuseEnabled ?? true) && lfPubKey && lfSecKey) {
    await traceLlmCall(
      { host: lfHost, publicKey: lfPubKey, secretKey: lfSecKey },
      {
        traceId: crypto.randomUUID(),
        name: 'resume-job-match',
        model,
        messages,
        output: result.content,
        startTime: result.startTime,
        endTime: result.endTime,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        metadata: {
          jobId: job.id,
          jobSubject: job.subject,
          resumeSubject: resume.subject,
        },
      }
    );
  }

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

/** Fetch job page content once for a URL. Handles LinkedIn /comm/ tracking URLs and login wall detection. */
export async function fetchJobContent(url: string): Promise<{ title: string; body: string } | null> {
  const linkedinJobId = url.match(/linkedin\.com\/comm\/jobs\/view\/(\d+)/)?.[1];
  const fetchUrl = linkedinJobId ? `https://www.linkedin.com/jobs/view/${linkedinJobId}/` : url;
  let page = await fetchJobPage(fetchUrl).catch(() => null);
  if (!page) page = await fetchJobPageViaTab(fetchUrl).catch(() => null);
  if (!page) return null;
  const loginWall = /^(sign in|log in|login|sign up|create account)/i;
  if (loginWall.test(page.title.trim())) return null;
  return page;
}

// Returns null if the URL is not a real job posting page
export async function analyzeUrl(
  resume: Resume,
  url: string,
  emailId: string,
  config: AppConfig
): Promise<AnalysisResult | null> {
  const page = await fetchJobContent(url);
  if (!page) return null;
  const fakeJob: JobEmail = { id: emailId, subject: page.title, body: page.body, urls: [url], date: Date.now() };
  return analyzePair(resume, fakeJob, config);
}
