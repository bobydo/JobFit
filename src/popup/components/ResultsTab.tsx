import { useState } from 'react';
import type { AnalysisResult } from '../types';

interface Props {
  results: AnalysisResult[];
  isAnalyzing: boolean;
  error: string | null;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#2e7d32' : score >= 40 ? '#e65100' : '#c62828';
  const bg = score >= 70 ? '#e8f5e9' : score >= 40 ? '#fff3e0' : '#ffebee';
  return (
    <span style={{ ...s.badge, color, background: bg }}>
      {score}%
    </span>
  );
}

export default function ResultsTab({ results, isAnalyzing, error }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (isAnalyzing && results.length === 0) {
    return <div style={s.center}>Analyzing… this may take a moment</div>;
  }

  if (error && results.length === 0) {
    return (
      <div style={s.center}>
        <span style={{ color: '#c00' }}>{error}</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={s.center}>
        No results yet.<br />
        <span style={s.hint}>Select job posts and click Analyze.</span>
      </div>
    );
  }

  // Group by job
  const byJob = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const group = byJob.get(r.jobEmailId) ?? [];
    group.push(r);
    byJob.set(r.jobEmailId, group);
  }

  return (
    <div>
      {isAnalyzing && (
        <div style={s.analyzingBanner}>Analyzing more results…</div>
      )}
      {error && (
        <div style={s.errorBanner}>{error}</div>
      )}
      {Array.from(byJob.entries()).map(([jobId, group]) => (
        <div key={jobId} style={s.jobGroup}>
          <div style={s.jobTitle}>{group[0].jobSubject}</div>
          {group.map((r) => {
            const key = `${r.jobEmailId}::${r.resumeId}`;
            const expanded = expandedKey === key;
            return (
              <div key={key} style={s.resultCard}>
                <div style={s.cardHeader} onClick={() => setExpandedKey(expanded ? null : key)}>
                  <ScoreBadge score={r.matchScore} />
                  <span style={s.resumeName}>{r.resumeSubject}</span>
                  <span style={s.chevron}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                  <div style={s.cardBody}>
                    <p style={s.summary}>{r.matchSummary}</p>
                    {r.skillsGaps.length > 0 && (
                      <>
                        <div style={s.gapsLabel}>Skills gaps</div>
                        <ul style={s.gapsList}>
                          {r.skillsGaps.map((g, i) => (
                            <li key={i} style={s.gapsItem}>{g}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div style={s.analyzedAt}>
                      Analyzed {new Date(r.analyzedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  center: { color: '#888', textAlign: 'center', paddingTop: 40, lineHeight: 1.8 },
  hint: { fontSize: 12, color: '#aaa' },
  analyzingBanner: {
    background: '#e8f0fe', border: '1px solid #c5d8fb', borderRadius: 6,
    padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#1a56c4',
  },
  errorBanner: {
    background: '#ffebee', border: '1px solid #f9a8a8', borderRadius: 6,
    padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#c62828',
  },
  jobGroup: { marginBottom: 12 },
  jobTitle: {
    fontSize: 12, fontWeight: 700, color: '#555',
    marginBottom: 4, paddingLeft: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  resultCard: { border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 6, overflow: 'hidden' },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px', cursor: 'pointer',
  },
  badge: {
    fontSize: 12, fontWeight: 700, padding: '2px 7px',
    borderRadius: 10, flexShrink: 0,
  },
  resumeName: {
    flex: 1, fontSize: 13, color: '#333', fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  chevron: { fontSize: 10, color: '#aaa', flexShrink: 0 },
  cardBody: { borderTop: '1px solid #f0f0f0', padding: '8px 12px 10px', background: '#fafafa' },
  summary: { fontSize: 12, color: '#444', lineHeight: 1.6, margin: '0 0 8px' },
  gapsLabel: { fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 },
  gapsList: { margin: '0 0 6px', paddingLeft: 18 },
  gapsItem: { fontSize: 12, color: '#555', lineHeight: 1.6 },
  analyzedAt: { fontSize: 10, color: '#bbb', marginTop: 6 },
};
