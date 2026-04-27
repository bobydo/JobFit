import { fetchJobPage, fetchJobPageViaTab } from '@utils/job_email/job-page-fetcher';
import { traceLlmCall } from '@utils/langfuse-tracer';
import {
  LANGFUSE_ENABLED, LANGFUSE_BASE_URL, LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY,
  DAILY_ANALYSIS_LIMIT, DAILY_WARN_THRESHOLD, LEAD_CAPTURE_MIN_SCORE, WORKER_URL,
  GROQ_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL, ANTHROPIC_DEFAULT_MODEL,
  OLLAMA_MODEL,
  AUTH_REQUIRED_DOMAINS,
} from '../config';
import { LLMProviderFactory } from '../llm/llm-provider-factory';
import { cacheStore, CacheStore } from '../storage/cache-store';
import { gmailClient } from '../gmail/gmail-client';
import type { Resume, JobEmail, AnalysisResult, AnalysisWeights } from '../popup/types';
import type { AppConfig } from '../storage/config-store';
import { PromptBuilder } from './prompt-builder';
import { AnalysisResponseParser } from './analysis-response-parser';

export class MatchAnalyzer {
  constructor(
    private _factory: LLMProviderFactory,
    private _cache: CacheStore,
    private _promptBuilder: PromptBuilder,
    private _parser: AnalysisResponseParser,
  ) {}

  async analyzePair(resume: Resume, job: JobEmail, config: AppConfig): Promise<AnalysisResult> {
    const messages = [
      { role: 'system' as const, content: 'You are a professional career advisor. Evaluate how well a candidate\'s resume matches a job posting. Be concise and honest.' },
      { role: 'user'   as const, content: this._promptBuilder.build(resume, job) },
    ];

    // Cloud mode: server enforces quota — skip local tracking entirely
    if (config.mode !== 'jobfit-cloud') {
      const count = await this._cache.getDailyCount();
      if (count >= DAILY_ANALYSIS_LIMIT) {
        const reset = new Date();
        reset.setDate(reset.getDate() + 1);
        reset.setHours(0, 0, 0, 0);
        const hh = reset.getHours().toString().padStart(2, '0');
        const mm = reset.getMinutes().toString().padStart(2, '0');
        throw new Error(
          `Daily limit reached — you've used ${count}/${DAILY_ANALYSIS_LIMIT} analyses today. ` +
          `Resets at midnight (${hh}:${mm} local time).`
        );
      }
      if (count >= DAILY_WARN_THRESHOLD) {
        console.warn(`[JobFit] Approaching daily limit: ${count}/${DAILY_ANALYSIS_LIMIT} used.`);
      }
      await this._cache.incrementDailyCount();
    }

    const provider = this._factory.create(config);
    const result   = await provider.chat(messages);
    const { matchScore, matchSummary, matchedSkills, skillsGaps, weights } = this._parser.parse(result.content);

    await this._sendTrace(config, messages, result, job, resume);

    // Lead capture — fire and forget, never blocks the result
    if (matchScore >= LEAD_CAPTURE_MIN_SCORE) {
      this._captureLead(config, job.subject, skillsGaps, weights, matchScore).catch(() => {});
    }

    const isPro = config.mode === 'jobfit-cloud';
    return {
      jobEmailId:    job.id,
      jobSubject:    job.subject,
      jobUrl:        job.urls[0] ?? '',
      resumeId:      resume.id,
      resumeSubject: resume.subject,
      matchScore,
      matchSummary,
      matchedSkills,
      skillsGaps:    isPro ? skillsGaps : [],
      weights:       isPro ? weights : undefined,
      analyzedAt: new Date(),
    };
  }

  private async _captureLead(
    config: AppConfig,
    jobTitle: string,
    skillsGaps: string[],
    weights: AnalysisWeights,
    score: number,
  ): Promise<void> {
    const isPro  = config.mode === 'jobfit-cloud';
    const email  = isPro ? undefined : await gmailClient.getProfile().catch(() => '');
    const token  = isPro ? config.subscriptionToken : undefined;
    if (!email && !token) return;

    await fetch(`${WORKER_URL}/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, jobTitle, skillsGaps, weights, score }),
    });
  }

  async fetchJobContent(
    url: string
  ): Promise<{ title: string; body: string } | { loginRequired: true; domain: string } | null> {
    const linkedinJobId = url.match(/linkedin\.com\/comm\/jobs\/view\/(\d+)/)?.[1];
    const fetchUrl = linkedinJobId ? `https://www.linkedin.com/jobs/view/${linkedinJobId}/` : url;
    let page = await fetchJobPage(fetchUrl).catch(() => null);
    if (!page) page = await fetchJobPageViaTab(fetchUrl).catch(() => null);
    if (!page) return null;

    const loginWall = /^(sign in|log in|login|sign up|create account)/i;
    if (loginWall.test(page.title.trim())) {
      const hostname = new URL(url).hostname;
      const found = Object.entries(AUTH_REQUIRED_DOMAINS).find(([d]) => hostname.includes(d));
      return { loginRequired: true, domain: found ? found[1].displayName : hostname };
    }
    return page;
  }

  async analyzeUrl(
    resume: Resume,
    url: string,
    emailId: string,
    config: AppConfig
  ): Promise<AnalysisResult | null> {
    const page = await this.fetchJobContent(url);
    if (!page || 'loginRequired' in page) return null;
    const fakeJob: JobEmail = { id: emailId, subject: page.title, body: page.body, urls: [url], date: Date.now() };
    return this.analyzePair(resume, fakeJob, config);
  }

  private _getModelName(config: AppConfig): string {
    switch (config.mode) {
      case 'groq':      return GROQ_DEFAULT_MODEL;
      case 'openai':    return OPENAI_DEFAULT_MODEL;
      case 'anthropic': return ANTHROPIC_DEFAULT_MODEL;
      case 'ollama':    return config.ollamaModel ?? OLLAMA_MODEL;
      default:          return config.mode;
    }
  }

  private async _sendTrace(
    config: AppConfig,
    messages: { role: string; content: string }[],
    result: { content: string; startTime: Date; endTime: Date; promptTokens: number; completionTokens: number },
    job: JobEmail,
    resume: Resume,
  ): Promise<void> {
    const lfHost   = config.langfuseHost      || LANGFUSE_BASE_URL;
    const lfPubKey = config.langfusePublicKey || LANGFUSE_PUBLIC_KEY;
    const lfSecKey = config.langfuseSecretKey || LANGFUSE_SECRET_KEY;

    if (!LANGFUSE_ENABLED || !(config.langfuseEnabled ?? true) || !lfPubKey || !lfSecKey) return;

    await traceLlmCall(
      { host: lfHost, publicKey: lfPubKey, secretKey: lfSecKey },
      {
        traceId: crypto.randomUUID(),
        name:    'resume-job-match',
        model:   this._getModelName(config),
        messages: messages as import('../llm/llm-provider').LLMMessage[],
        output:  result.content,
        startTime: result.startTime,
        endTime:   result.endTime,
        promptTokens:     result.promptTokens,
        completionTokens: result.completionTokens,
        metadata: { jobId: job.id, jobSubject: job.subject, resumeSubject: resume.subject },
      }
    );
  }
}

// Singleton with default dependencies
export const matchAnalyzer = new MatchAnalyzer(
  new LLMProviderFactory(),
  cacheStore,
  new PromptBuilder(),
  new AnalysisResponseParser(),
);

// Named exports for existing callers
export const analyzePair    = (resume: Resume, job: JobEmail, config: AppConfig) =>
  matchAnalyzer.analyzePair(resume, job, config);

export const fetchJobContent = (url: string) =>
  matchAnalyzer.fetchJobContent(url);

export const analyzeUrl = (resume: Resume, url: string, emailId: string, config: AppConfig) =>
  matchAnalyzer.analyzeUrl(resume, url, emailId, config);
