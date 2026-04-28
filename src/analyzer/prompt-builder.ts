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
      'matchedSkills: list 3–5 specific skills or experiences THIS candidate has that directly match this role\'s requirements.',
      '',
      'skillsGaps: list the specific skills or experiences THIS candidate is missing for THIS role, framed as actionable items. Be specific to the candidate\'s background, not generic job requirements.',
      '',
      'weights: 4 integers (0–100) that sum to exactly 100, reflecting how much THIS role weights each dimension.',
      '',
      'Reply ONLY with valid JSON — no markdown, no explanation:',
      '{"matchScore": <0-100>, "matchSummary": "<5-6 sentences>", "matchedSkills": ["<s1>", "<s2>", "<s3>"], "skillsGaps": ["<gap1>", "<gap2>", "<gap3>", "<gap4>", "<gap5>", "<gap6>"], "weights": {"skills": <0-100>, "experience": <0-100>, "tools": <0-100>, "domain": <0-100>}}',
    ].join('\n');
  }

  buildPro(resume: Resume, job: JobEmail): string {
    const base = this.build(resume, job);
    const proAddition = [
      '',
      'skillsGapsDetailed: same gaps as skillsGaps, but each as an object with priority label.',
      '- "required": job uses words like "required", "must have", "minimum", "essential", or lists it under Requirements',
      '- "preferred": job uses "preferred", "nice to have", "a plus", "bonus", or lists it under Preferred Qualifications',
      'If unclear, default to "required".',
      '',
      'Add this field to your JSON response:',
      '"skillsGapsDetailed": [{"skill": "<gap1>", "priority": "required|preferred"}, ...]',
    ].join('\n');
    return base + proAddition;
  }
}
