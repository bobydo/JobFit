import { useEffect, useState } from 'react';
import { listMessages, getMessage, getSubject, getPlainTextBody } from '@gmail/gmail-client';

interface Resume {
  id: string;
  subject: string;
  body: string;
}

interface Props {
  activeResumeId: string | null;
  onSetActive: (id: string) => void;
}

export default function ResumesTab({ activeResumeId, onSetActive }: Props) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tooMany, setTooMany] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setStatus('loading');
    try {
      const stubs = await listMessages('resumes', 3); // fetch 3 to detect >2
      if (stubs.length > 2) setTooMany(true);
      const top2 = stubs.slice(0, 2);
      const messages = await Promise.all(top2.map((s) => getMessage(s.id)));
      const loaded: Resume[] = messages.map((msg) => ({
        id: msg.id,
        subject: getSubject(msg),
        body: getPlainTextBody(msg),
      }));
      setResumes(loaded);
      if (!activeResumeId && loaded.length > 0) onSetActive(loaded[0].id);
      setStatus('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
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
      {tooMany && (
        <div style={s.warning}>
          Only 2 resumes supported. Showing the 2 most recent.
        </div>
      )}
      {resumes.map((r) => {
        const isActive = r.id === activeResumeId;
        const isExpanded = r.id === expandedId;
        return (
          <div key={r.id} style={{ ...s.card, ...(isActive ? s.cardActive : {}) }}>
            <div style={s.cardHeader}>
              <button
                style={{ ...s.subjectBtn, ...(isActive ? s.subjectActive : {}) }}
                onClick={() => onSetActive(r.id)}
                title="Set as active resume for analysis"
              >
                {isActive && <span style={s.check}>✓ </span>}
                {r.subject}
              </button>
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
  warning: {
    background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6,
    padding: '6px 10px', fontSize: 12, marginBottom: 8, color: '#856404',
  },
  card: { border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  cardActive: { borderColor: '#1a73e8' },
  cardHeader: { display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6 },
  subjectBtn: {
    flex: 1, textAlign: 'left', background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 13, color: '#333', fontWeight: 500,
  },
  subjectActive: { color: '#1a73e8' },
  check: { color: '#1a73e8' },
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
