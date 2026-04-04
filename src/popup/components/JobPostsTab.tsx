import { useEffect, useState } from 'react';
import { listMessages, getMessage, getSubject, getPlainTextBody } from '@gmail/gmail-client';

interface JobEmail {
  id: string;
  subject: string;
  urls: string[];
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) ?? [];
  return [...new Set(matches)];
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export default function JobPostsTab() {
  const [emails, setEmails] = useState<JobEmail[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setStatus('loading');
    try {
      const stubs = await listMessages('jobposts', 20);
      const messages = await Promise.all(stubs.map((s) => getMessage(s.id)));
      const loaded: JobEmail[] = messages.map((msg) => ({
        id: msg.id,
        subject: getSubject(msg),
        urls: extractUrls(getPlainTextBody(msg)),
      }));
      setEmails(loaded);
      setStatus('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  if (status === 'loading') return <div style={s.center}>Loading job posts…</div>;
  if (status === 'error') return <div style={s.center}><span style={{ color: '#c00' }}>{error}</span></div>;

  if (emails.length === 0) {
    return (
      <div style={s.empty}>
        <p>No job posts found.</p>
        <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          Apply the <code>jobposts</code> label to job alert emails<br />
          from LinkedIn, Indeed, or similar.
        </p>
      </div>
    );
  }

  return (
    <div>
      {emails.map((email) => {
        const isExpanded = email.id === expandedId;
        return (
          <div key={email.id} style={s.card}>
            <button
              style={s.cardHeader}
              onClick={() => setExpandedId(isExpanded ? null : email.id)}
            >
              <span style={s.subject}>{email.subject}</span>
              <span style={s.meta}>{email.urls.length} URL{email.urls.length !== 1 ? 's' : ''}</span>
              <span style={s.arrow}>{isExpanded ? '▲' : '▼'}</span>
            </button>
            {isExpanded && (
              <div style={s.urlList}>
                {email.urls.length === 0 ? (
                  <p style={s.noUrls}>No URLs found in this email.</p>
                ) : (
                  email.urls.map((url, i) => (
                    <div key={i} style={s.urlRow}>
                      <span style={s.urlText} title={url}>{truncate(url, 42)}</span>
                      <button style={s.analyzeBtn} disabled title="Coming in Stage 5">
                        Analyze
                      </button>
                    </div>
                  ))
                )}
              </div>
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
  card: { border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  cardHeader: {
    display: 'flex', alignItems: 'center', width: '100%',
    padding: '8px 10px', background: 'none', border: 'none',
    cursor: 'pointer', gap: 6, textAlign: 'left',
  },
  subject: {
    flex: 1, fontSize: 13, color: '#333', fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { fontSize: 11, color: '#888', whiteSpace: 'nowrap' },
  arrow: { fontSize: 11, color: '#888', marginLeft: 2, flexShrink: 0 },
  urlList: { borderTop: '1px solid #f0f0f0', padding: '6px 10px 10px' },
  noUrls: { fontSize: 12, color: '#888', margin: '4px 0' },
  urlRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0', borderBottom: '1px solid #f5f5f5',
  },
  urlText: {
    flex: 1, fontSize: 11, color: '#555',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },
  analyzeBtn: {
    fontSize: 11, padding: '3px 8px', border: '1px solid #ccc',
    borderRadius: 4, background: '#f5f5f5', cursor: 'not-allowed',
    color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0,
  },
};
