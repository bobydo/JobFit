import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { Resume, JobEmail } from '../popup/types';
import { compareToBaseline } from '@utils/result-comparator';

// Stub chrome APIs — not available in the Node/Vitest environment
const chromeStorageData: Record<string, unknown> = {};
(globalThis as unknown as Record<string, unknown>).chrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: chromeStorageData[key] })),
      set: vi.fn((data: Record<string, unknown>) => { Object.assign(chromeStorageData, data); return Promise.resolve(); }),
    },
  },
};;

import { analyzePair } from './match-analyzer';

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
  date: Date.now(),
};

const testConfig = {
  mode: 'ollama' as const,
  saveFolder: 'jobfit',
  langfuseEnabled: true,
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen3:8b',
  maxResumes: 2,
  maxJobPosts: 60,
  staleJobDays: 10,
};

beforeEach(() => vi.clearAllMocks());

describe('match-analyzer — integration with Ollama', () => {
  it('returns valid score + skill gaps and generates a prompt log', async () => {
    const result = await analyzePair(RESUME, JOB, testConfig);

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

  }, 120_000); // 2-min timeout — LLM cold start can be slow
});
