export interface MatchResult {
  matchScore: number;
  skillsGaps: string[];
}

export interface SimilarityReport {
  scoreDelta: number;       // actual - baseline (positive = higher than baseline)
  gapOverlap: number;       // 0–1, fraction of baseline gaps covered by actual result
  missingGaps: string[];    // baseline gaps whose keywords don't appear in actual result
}

export function compareToBaseline(
  baseline: MatchResult,
  actual: MatchResult,
): SimilarityReport {
  const scoreDelta = actual.matchScore - baseline.matchScore;

  // For each baseline gap, extract meaningful words (>3 chars) and check if any appear in actual gaps
  const baselineKeywords = baseline.skillsGaps.map((g) =>
    g.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
  );
  const actualText = actual.skillsGaps.join(' ').toLowerCase();

  const coveredMask = baselineKeywords.map((words) =>
    words.some((w) => actualText.includes(w))
  );

  return {
    scoreDelta,
    gapOverlap: coveredMask.filter(Boolean).length / baselineKeywords.length,
    missingGaps: baseline.skillsGaps.filter((_, i) => !coveredMask[i]),
  };
}
