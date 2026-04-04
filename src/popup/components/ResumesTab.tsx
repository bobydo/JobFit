import { useEffect, useState } from 'react';
import { listMessages, getMessage, getSubject, getPlainTextBody } from '@gmail/gmail-client';
import { getCached, setCached } from '@storage/cache-store';
import { getConfig } from '@storage/config-store';
import type { Resume } from '../types';

interface Props {
  activeResumeIds: string[];
  onToggle: (id: string) => void;
  onInitIds: (ids: string[]) => void;
  cachedData: Resume[] | null;
  onDataLoaded: (data: Resume[]) => void;
}

export default function ResumesTab({ activeResumeIds, onToggle, onInitIds, cachedData, onDataLoaded }: Props) {
  const [resumes, setResumes] = useState<Resume[]>(cachedData ?? []);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(cachedData ? 'loaded' : 'loading');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (cachedData) return; // in-memory hit — skip entirely
    load();
  }, []);

  async function load() {
    setStatus('loading');
    try {
      // check persistent cache before hitting Gmail API
      const stored = await getCached<Resume[]>('resumes');
      if (stored) {
        apply(stored);
        return;
      }
      const { maxResumes } = await getConfig();
      const stubs = await listMessages('resumes', maxResumes);
      const messages = await Promise.all(stubs.map((s) => getMessage(s.id)));
      const loaded: Resume[] = messages.map((msg) => ({
        id: msg.id,
        subject: getSubject(msg),
        body: getPlainTextBody(msg),
      }));
      await setCached('resumes', loaded);
      apply(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  function apply(data: Resume[]) {
    setResumes(data);
    onDataLoaded(data);
    if (activeResumeIds.length === 0 && data.length > 0) {
      getConfig().then(({ maxResumes }) => onInitIds(data.slice(0, maxResumes).map((r) => r.id)));
    }
    setStatus('loaded');
  }

  if (status === 'loading') return <div style={s.center}>Loading resumes…</div>;
  if (status === 'error') return <div style={s.center}><span style={{ color: '#c00' }}>{error}</span></div>;

  if (resumes.length === 0) {
    return (
      <div style={s.empty}>
        <p>No resumes found.</p>
        <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          Send yourself an email with your resume as the body,<br />
          then apply the <code>resumes</code> label.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={s.hint}>
        Select up to 2 for analysis ({activeResumeIds.length}/2 selected)
      </div>
      {resumes.map((r) => {
        const checked = activeResumeIds.includes(r.id);
        const isExpanded = r.id === expandedId;
        return (
          <div key={r.id} style={{ ...s.card, ...(checked ? s.cardChecked : {}) }}>
            <div style={s.cardHeader}>
              <label style={s.label}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(r.id)}
                  style={s.checkbox}
                />
                <span style={{ ...s.subject, ...(checked ? s.subjectChecked : {}) }}>
                  {r.subject}
                </span>
              </label>
              <button
                style={s.expandBtn}
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                title={isExpanded ? 'Collapse' : 'Expand body'}
              >
                {isExpanded ? '▲' : '▼'}
              </button>
            </div>
            {isExpanded && (
              <pre style={s.body}>{r.body || '(empty body)'}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  center: { color: '#888', textAlign: 'center', paddingTop: 40 },
  empty: { textAlign: 'center', paddingTop: 32, color: '#555', lineHeight: 1.6 },
  hint: { fontSize: 12, color: '#1a73e8', fontWeight: 600, marginBottom: 8 },
  card: { border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  cardChecked: { borderColor: '#1a73e8', background: '#f8fbff' },
  cardHeader: { display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6 },
  label: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  checkbox: { width: 15, height: 15, accentColor: '#1a73e8', flexShrink: 0, cursor: 'pointer' },
  subject: { fontSize: 13, color: '#333', fontWeight: 500 },
  subjectChecked: { color: '#1a73e8' },
  expandBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: '#888', padding: '2px 6px', flexShrink: 0,
  },
  body: {
    margin: 0, padding: '8px 12px 12px', fontSize: 11, lineHeight: 1.5,
    color: '#444', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    maxHeight: 180, overflowY: 'auto',
    borderTop: '1px solid #f0f0f0', background: '#fafafa',
  },
};
