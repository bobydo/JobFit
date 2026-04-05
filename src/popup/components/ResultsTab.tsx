import { useState } from 'react';
import type { AnalysisResult } from '../types';

interface Props {
  results: AnalysisResult[];
  isAnalyzing: boolean;
  error: string | null;
}

function downloadResults(results: AnalysisResult[]) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Group by job
  const byJob = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const group = byJob.get(r.jobEmailId) ?? [];
    group.push(r);
    byJob.set(r.jobEmailId, group);
  }

  const scoreColor = (s: number) => s >= 70 ? '#2e7d32' : s >= 40 ? '#e65100' : '#c62828';
  const scoreBg = (s: number) => s >= 70 ? '#e8f5e9' : s >= 40 ? '#fff3e0' : '#ffebee';

  const jobSections = Array.from(byJob.values()).map((group) => {
    const job = group[0];
    const jobLink = job.jobUrl ? `<a href="${job.jobUrl}" style="font-size:12px;color:#1a73e8;">View job posting →</a>` : '';
    const cards = group.map((r) => `
      <div style="border:1px solid #e5e5e5;border-radius:8px;margin-bottom:8px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fafafa;">
          <span style="font-size:13px;font-weight:700;padding:2px 8px;border-radius:10px;color:${scoreColor(r.matchScore)};background:${scoreBg(r.matchScore)};">${r.matchScore}%</span>
          <span style="font-size:13px;font-weight:600;color:#333;">${r.resumeSubject}</span>
        </div>
        <div style="padding:10px 14px;">
          <p style="font-size:12px;color:#444;line-height:1.7;margin:0 0 8px;">${r.matchSummary}</p>
          ${r.skillsGaps.length > 0 ? `<div style="font-size:11px;font-weight:700;color:#888;margin-bottom:4px;">Skills gaps</div><ul style="margin:0 0 6px;padding-left:18px;">${r.skillsGaps.map((g) => `<li style="font-size:12px;color:#555;line-height:1.6;">${g}</li>`).join('')}</ul>` : ''}
          <div style="font-size:10px;color:#bbb;margin-top:4px;">Analyzed ${new Date(r.analyzedAt).toLocaleString()}</div>
        </div>
      </div>`).join('');
    return `
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:4px;">${job.jobSubject}</div>
        ${jobLink}
        <div style="margin-top:8px;">${cards}</div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>JobFit Results ${date}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#222;">
  <h1 style="font-size:20px;margin-bottom:4px;">JobFit Results</h1>
  <p style="font-size:12px;color:#888;margin-bottom:24px;">Generated ${new Date().toLocaleString()}</p>
  ${jobSections}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: `jobfit-results_${date}.html` }, () => {
    URL.revokeObjectURL(url);
  });
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

  // Group by URL (each URL = one job posting)
  const byJob = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const key = r.jobUrl || r.jobEmailId;
    const group = byJob.get(key) ?? [];
    group.push(r);
    byJob.set(key, group);
  }

  return (
    <div>
      <div style={s.toolbar}>
        <button style={s.downloadBtn} onClick={() => downloadResults(results)}>↓ Download Report</button>
      </div>
      {isAnalyzing && (
        <div style={s.analyzingBanner}>⚠ Analyzing… Keep this popup open until done.</div>
      )}
      {error && (
        <div style={s.errorBanner}>{error}</div>
      )}
      {Array.from(byJob.entries()).map(([groupKey, group]) => (
        <div key={groupKey} style={s.jobGroup}>
          <div style={s.jobTitle}>{group[0].jobSubject}</div>
          {group.map((r) => {
            const key = `${r.jobUrl || r.jobEmailId}::${r.resumeId}`;
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
                    {r.jobUrl && (
                      <a
                        href={r.jobUrl}
                        style={s.jobLink}
                        onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: r.jobUrl }); }}
                      >View job posting →</a>
                    )}
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
  toolbar: { display: 'flex', justifyContent: 'flex-end', marginBottom: 8 },
  downloadBtn: {
    background: 'none', border: '1px solid #ccc', borderRadius: 5,
    padding: '3px 10px', fontSize: 12, color: '#555', cursor: 'pointer',
  },
  analyzingBanner: {
    background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 6,
    padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#e65100', fontWeight: 600,
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
  jobLink: { display: 'inline-block', fontSize: 11, color: '#1a73e8', marginBottom: 8, textDecoration: 'none' },
};
