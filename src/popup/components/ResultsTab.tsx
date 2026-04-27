import { useState } from 'react';
import type { AnalysisResult, LoginWallResult } from '../types';
import { resultsStyles as s } from './shared.styles';
import ScoreBadge from './lessChange/ScoreBadge';
import SignInPrompt from './SignInPrompt';

interface Props {
  results: AnalysisResult[];
  loginWalls: LoginWallResult[];
  isAnalyzing: boolean;
  progress: { done: number; total: number } | null;
  error: string | null;
  isPro: boolean;
  onClear: () => void;
}

const pill = (text: string, color: string, bg: string) =>
  `<span style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;color:${color};background:${bg};margin:2px;">${text}</span>`;

function downloadResults(results: AnalysisResult[], isPro: boolean) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const byJob = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const key = r.jobUrl || r.jobEmailId;
    byJob.set(key, [...(byJob.get(key) ?? []), r]);
  }

  const scoreColor = (sc: number) => sc >= 70 ? '#2e7d32' : sc >= 40 ? '#e65100' : '#c62828';
  const scoreBg    = (sc: number) => sc >= 70 ? '#e8f5e9' : sc >= 40 ? '#fff3e0' : '#ffebee';

  const jobSections = Array.from(byJob.values()).map((group) => {
    const job     = group[0];
    const jobLink = job.jobUrl ? `<a href="${job.jobUrl}" style="font-size:12px;color:#1a73e8;">View job posting →</a>` : '';
    const cards   = group.map((r) => {
      const matched = r.matchedSkills?.length
        ? `<div style="margin:8px 0 4px;font-size:11px;font-weight:700;color:#2e7d32;">✓ Matched skills</div><div>${r.matchedSkills.map(s => pill(s, '#2e7d32', '#e8f5e9')).join('')}</div>`
        : '';
      const weights = isPro && r.weights
        ? `<div style="margin:8px 0 4px;font-size:11px;font-weight:700;color:#888;">Role weighting</div><div>${Object.entries(r.weights).map(([k, v]) => pill(`${k} ${v}%`, '#1a73e8', '#f0f6ff')).join('')}</div>`
        : '';
      const gaps = isPro && r.skillsGaps.length
        ? `<div style="margin:8px 0 4px;font-size:11px;font-weight:700;color:#c62828;">✗ Skill gaps</div><ul style="margin:4px 0;padding-left:18px;">${r.skillsGaps.map(g => `<li style="font-size:12px;color:#555;line-height:1.6;">${g}</li>`).join('')}</ul>`
        : '';
      return `
      <div style="border:1px solid #e5e5e5;border-radius:8px;margin-bottom:8px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fafafa;">
          <span style="font-size:13px;font-weight:700;padding:2px 8px;border-radius:10px;color:${scoreColor(r.matchScore)};background:${scoreBg(r.matchScore)};">${r.matchScore}%</span>
          <span style="font-size:13px;font-weight:600;color:#333;">${r.resumeSubject}</span>
        </div>
        <div style="padding:10px 14px;">
          <p style="font-size:12px;color:#444;line-height:1.7;margin:0 0 8px;">${r.matchSummary}</p>
          ${matched}${weights}${gaps}
          <div style="font-size:10px;color:#bbb;margin-top:6px;">Analyzed ${new Date(r.analyzedAt).toLocaleString()}</div>
        </div>
      </div>`;
    }).join('');
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
  const url  = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: `jobfit-results_${date}.html` }, () => URL.revokeObjectURL(url));
}

export default function ResultsTab({ results, loginWalls, isAnalyzing, progress, error, isPro, onClear }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (isAnalyzing && results.length === 0) {
    return <div style={s.center}>Analyzing… this may take a moment</div>;
  }
  if (error && results.length === 0) {
    return <div style={s.center}><span style={{ color: '#c00' }}>{error}</span></div>;
  }
  if (results.length === 0 && loginWalls.length === 0) {
    return (
      <div style={s.center}>
        No results yet.<br />
        <span style={s.hint}>Select job posts and click Analyze.</span>
      </div>
    );
  }

  const byJob = new Map<string, AnalysisResult[]>();
  for (const r of results) {
    const key = r.jobUrl || r.jobEmailId;
    byJob.set(key, [...(byJob.get(key) ?? []), r]);
  }

  return (
    <div>
      <div style={s.toolbar}>
        <button style={s.downloadBtn} onClick={() => downloadResults(results, isPro)}>↓ Download Report</button>
        <button style={{ ...s.downloadBtn, marginLeft: 6, background: 'none', color: '#888', border: '1px solid #ddd' }} onClick={onClear}>🗑 Clear</button>
      </div>
      {isAnalyzing && (
        <div style={s.analyzingBanner}>
          ⚠ Analyzing… {progress ? `${progress.done}/${progress.total} jobs` : ''}
        </div>
      )}
      {error && <div style={s.errorBanner}>{error}</div>}
      {loginWalls.length > 0 && (
        <div style={s.jobGroup}>
          {loginWalls.map((lw) => <SignInPrompt key={lw.jobUrl} {...lw} />)}
        </div>
      )}
      {Array.from(byJob.entries()).map(([groupKey, group]) => (
        <div key={groupKey} style={s.jobGroup}>
          <div style={s.jobTitle}>{group[0].jobSubject}</div>
          {group.map((r) => {
            const key      = `${r.jobUrl || r.jobEmailId}::${r.resumeId}`;
            const expanded = expandedKey === key;
            return (
              <div key={key} style={s.card}>
                <div style={s.cardHeader} onClick={() => setExpandedKey(expanded ? null : key)}>
                  <ScoreBadge score={r.matchScore} />
                  <span style={s.resumeName}>
                    {r.resumeSubject}
                    {r.jobUrl && (() => {
                      const jobId = r.jobUrl.match(/\/(\d+)\//)?.[1];
                      return <span style={s.jobTag}>[{jobId ? `#${jobId}` : r.jobSubject}]</span>;
                    })()}
                  </span>
                  <span style={s.chevron}>{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                  <div style={s.cardBody}>
                    {r.jobUrl && (
                      <a href={r.jobUrl} style={s.jobLink}
                        onClick={(e) => { e.preventDefault(); chrome.windows.create({ url: r.jobUrl, type: 'normal' }); }}>
                        View job posting →
                      </a>
                    )}
                    <p style={s.summary}>{r.matchSummary}</p>

                    {/* Matched skills — both modes */}
                    {r.matchedSkills && r.matchedSkills.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ ...s.gapsLabel, color: '#2e7d32' }}>✓ Matched skills</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {r.matchedSkills.map((sk, i) => (
                            <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }}>
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pro: role weighting */}
                    {isPro && r.weights && (
                      <div style={{ marginTop: 8 }}>
                        <div style={s.gapsLabel}>Role weighting</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                          {Object.entries(r.weights).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0f6ff', color: '#1a73e8', fontWeight: 600 }}>
                              {k} {v}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pro: skill gaps */}
                    {isPro && r.skillsGaps.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ ...s.gapsLabel, color: '#c62828' }}>✗ Skill gaps</div>
                        <ul style={s.gapsList}>
                          {r.skillsGaps.map((g, i) => <li key={i} style={s.gapsItem}>{g}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* BYOK: upsell hint */}
                    {!isPro && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#888', fontStyle: 'italic' }}>
                        🔒 <a
                          href="#"
                          style={{ color: '#1a73e8', textDecoration: 'none' }}
                          onClick={(e) => { e.preventDefault(); chrome.runtime.sendMessage({ type: 'open_settings' }); }}
                        >
                          Get JobFit Pro
                        </a> to see missed skills and full skill gap analysis.
                      </div>
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
