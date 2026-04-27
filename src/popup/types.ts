export interface Resume {
  id: string;
  subject: string;
  body: string;
}

export interface JobEmail {
  id: string;
  subject: string;
  body: string;
  urls: string[];
  date: number;
}

export interface LoginWallResult {
  jobUrl: string;
  domain: string;   // display name: 'LinkedIn', 'Indeed', 'Glassdoor'
}

export interface AnalysisWeights {
  skills: number;
  experience: number;
  tools: number;
  domain: number;
}

export interface AnalysisResult {
  jobEmailId: string;
  jobSubject: string;
  resumeId: string;
  resumeSubject: string;
  jobUrl: string;
  matchScore: number;        // 0–100
  matchSummary: string;
  matchedSkills?: string[];  // both modes
  skillsGaps: string[];      // [] for BYOK; populated for Pro
  weights?: AnalysisWeights; // Pro mode only
  analyzedAt: Date;
}
