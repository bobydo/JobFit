import { useEffect, useState } from 'react';
import { listMessages, getMessage, getSubject, getPlainTextBody } from '@gmail/gmail-client';
import { getCached, setCached } from '@storage/cache-store';
import type { Resume } from '../types';
import { resumesStyles as s } from './shared.styles';

interface Props {
  activeResumeIds: string[];
  onToggle: (id: string) => void;
  onInitIds: (ids: string[]) => void;
  cachedData: Resume[] | null;
  onDataLoaded: (data: Resume[]) => void;
  maxResumes: number;
}

export default function ResumesTab({ activeResumeIds, onToggle, onInitIds, cachedData, onDataLoaded, maxResumes }: Props) {
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
      const stubs = await listMessages('resumes', 20); // fetch all, selection cap is separate
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
      onInitIds([data[0].id]); // auto-select only the most recent; user picks the second
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
        Select up to {maxResumes} for analysis ({activeResumeIds.length}/{maxResumes} selected)
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
              <pre style={s.cardBody}>{r.body || '(empty body)'}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

