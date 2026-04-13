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

export interface AnalysisResult {
  jobEmailId: string;
  jobSubject: string;
  resumeId: string;
  resumeSubject: string;
  jobUrl: string;
  matchScore: number;       // 0–100
  matchSummary: string;
  skillsGaps: string[];
  analyzedAt: Date;
}
