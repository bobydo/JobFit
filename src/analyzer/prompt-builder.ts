import { RESUME_TEXT_MAX_CHARS, JOB_TEXT_MAX_CHARS } from '../config';
import type { Resume, JobEmail } from '../popup/types';

export class PromptBuilder {
  build(resume: Resume, job: JobEmail): string {
    const resumeText = resume.body.trim().slice(0, RESUME_TEXT_MAX_CHARS);
    const jobText    = job.body.trim().slice(0, JOB_TEXT_MAX_CHARS);

    return [
      `Resume (${resume.subject}):`,
      resumeText,
      '',
      `Job posting (${job.subject}):`,
      jobText,
      '',
      'Scoring rules:',
      '- Score 0–100 reflecting overall fit.',
      '- First, identify whether this role is skills-heavy, experience-heavy, tools-heavy, or domain-heavy, then weight your evaluation accordingly.',
      '- Hard missing requirements (named technology + required years) reduce the score significantly.',
      '- Genuine transferable skills (architecture, AI/LLM, CI/CD, system integration) count toward the score.',
      '- Do NOT apply a hard cap — balance gaps against real strengths.',
      '',
      'skillsGaps: list the specific skills or experiences THIS candidate is missing for THIS role, framed as actionable items. Be specific to the candidate\'s background, not generic job requirements.',
      '',
      'weights: 4 integers (0–100) that sum to exactly 100, reflecting how much THIS role weights each dimension.',
      '',
      'Reply ONLY with valid JSON — no markdown, no explanation:',
      '{"matchScore": <0-100>, "matchSummary": "<5-6 sentences>", "skillsGaps": ["<gap1>", "<gap2>", "<gap3>", "<gap4>", "<gap5>", "<gap6>"], "weights": {"skills": <0-100>, "experience": <0-100>, "tools": <0-100>, "domain": <0-100>}}',
    ].join('\n');
  }
}
