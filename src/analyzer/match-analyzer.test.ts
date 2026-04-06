import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { Resume, JobEmail } from '../popup/types';
import { writeTestLog } from '@utils/test-logger';
import { compareToBaseline } from '@utils/result-comparator';

// Mock savePromptLog — intercepts before chrome.downloads is called, captures log data
vi.mock('@utils/prompt-logger', () => ({ savePromptLog: vi.fn() }));

// Import after mock is registered
import { analyzePair } from './match-analyzer';
import { savePromptLog } from '@utils/prompt-logger';

const SAMPLES = resolve(dirname(fileURLToPath(import.meta.url)), '../../samples/TestResume');

const RESUME: Resume = {
  id: 'test-resume-1',
  subject: 'Full Stack Developer',
  body: readFileSync(resolve(SAMPLES, 'Full Stack Developer.txt'), 'utf-8'),
};

const JOB: JobEmail = {
  id: 'test-job-1',
  subject: 'Applications Software Developer — Ford EV',
  body: readFileSync(resolve(SAMPLES, 'JobPost.txt'), 'utf-8'),
  urls: [],
  date: new Date(),
};

// Keys come from src/config.ts — no .env needed
const langfuseConfig = { saveFolder: 'jobfit', langfuseEnabled: true };

beforeEach(() => vi.clearAllMocks());

describe('match-analyzer — integration with Ollama', () => {
  it('returns valid score + skill gaps and generates a prompt log', async () => {
    const result = await analyzePair(RESUME, JOB, 'http://localhost:11434', 'qwen3:8b', langfuseConfig);

    // ── result ────────────────────────────────────────────────────────────
    console.log('\n══════════════ Match Result ══════════════');
    console.log('Score:      ', result.matchScore);
    console.log('Summary:    ', result.matchSummary);
    console.log('Skill gaps: ', result.skillsGaps);

    expect(result.matchScore).toBeGreaterThanOrEqual(0);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(typeof result.matchSummary).toBe('string');
    expect(result.matchSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.skillsGaps)).toBe(true);

    // ── prompt log ────────────────────────────────────────────────────────
    expect(savePromptLog).toHaveBeenCalledOnce();

    const log = vi.mocked(savePromptLog).mock.calls[0][0];

    console.log('\n══════════════ Prompt Log ══════════════');
    for (const msg of log.messages) {
      console.log(`\n── [${msg.role}] ──`);
      console.log(msg.content.length > 600
        ? msg.content.slice(0, 600) + '\n…(truncated)'
        : msg.content);
    }
    console.log('\n── Raw LLM response ──');
    console.log(log.rawResponse.length > 800
      ? log.rawResponse.slice(0, 800) + '\n…(truncated)'
      : log.rawResponse);
    console.log('\n── Stats ──');
    console.log('Prompt tokens:    ', log.promptTokens);
    console.log('Completion tokens:', log.completionTokens);
    console.log('Latency (ms):     ', log.latencyMs);

    expect(log.messages).toHaveLength(2);
    expect(log.messages[0].role).toBe('system');
    expect(log.messages[1].role).toBe('user');
    expect(log.messages[1].content).toContain('Full Stack Developer'); // resume subject in prompt
    expect(log.messages[1].content).toContain('Ford');                 // job text in prompt
    expect(log.messages[1].content).toContain('LangGraph');            // late in resume — proves 6000 char limit works
    expect(log.promptTokens).toBeGreaterThan(0);
    expect(log.completionTokens).toBeGreaterThan(0);
    expect(log.rawResponse.length).toBeGreaterThan(0);
    expect(log.parsedResult.matchScore).toBe(result.matchScore);

    // ── baseline similarity check ─────────────────────────────────────────
    const baseline = JSON.parse(readFileSync(resolve(SAMPLES, 'LLMresult.json'), 'utf-8'));
    const report = compareToBaseline(baseline, {
      matchScore: result.matchScore,
      skillsGaps: result.skillsGaps,
    });

    console.log('\n── Similarity vs baseline ──');
    console.log('Score delta :', report.scoreDelta, '(baseline:', baseline.matchScore, ')');
    console.log('Gap overlap :', (report.gapOverlap * 100).toFixed(0) + '%');
    console.log('Missing gaps:', report.missingGaps);

    expect(Math.abs(report.scoreDelta)).toBeLessThan(20);  // score within ±20 of baseline
    expect(report.gapOverlap).toBeGreaterThan(0.5);        // ≥50% of key gaps covered

    // ── write real JSON log to src/logs/ for inspection ──────────────────
    const logPath = writeTestLog(import.meta.url, log);
    console.log('\nLog written to:', logPath);
  }, 120_000); // 2-min timeout — LLM cold start can be slow
});
