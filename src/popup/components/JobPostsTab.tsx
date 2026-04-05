import { useEffect, useState } from 'react';
import { listMessages, getMessage, getSubject, getPlainTextBody, getInternalDate } from '@gmail/gmail-client';
import { getCached, setCached, getProcessedIds, markProcessed } from '@storage/cache-store';
import { getConfig } from '@storage/config-store';
import type { JobEmail } from '../types';

type ProcessMode = 'daily' | 'handpick';

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) ?? [];
  return [...new Set(matches)];
}

function formatDate(date: Date): string {
  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
  if (date.toDateString() === todayStr) return 'Today';
  if (date.toDateString() === yesterdayStr) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  cachedData: JobEmail[] | null;
  onDataLoaded: (data: JobEmail[]) => void;
  onAnalyze: (jobs: JobEmail[]) => void;
  isAnalyzing: boolean;
}

export default function JobPostsTab({ cachedData, onDataLoaded, onAnalyze, isAnalyzing }: Props) {
  const [emails, setEmails] = useState<JobEmail[]>(cachedData ?? []);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(cachedData ? 'loaded' : 'loading');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processMode, setProcessMode] = useState<ProcessMode>('handpick');
  const [showDailyConfirm, setShowDailyConfirm] = useState(false);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [staleCount, setStaleCount] = useState(0);
  const [staleJobDays, setStaleJobDaysState] = useState(10);

  // Restore saved process mode + processed IDs
  useEffect(() => {
    chrome.storage.local.get('jobPostsProcessMode', (result) => {
      if (result.jobPostsProcessMode) setProcessMode(result.jobPostsProcessMode as ProcessMode);
    });
    getProcessedIds().then(setProcessedIds);
  }, []);

  useEffect(() => {
    if (cachedData) return;
    load();
  }, []);

  async function load() {
    setStatus('loading');
    try {
      const stored = await getCached<JobEmail[]>('jobposts');
      if (stored) {
        const restored = stored.map((e) => ({ ...e, date: new Date(e.date) }));
        apply(restored);
        return;
      }
      const { maxJobPostsPerDay } = await getConfig();
      const stubs = await listMessages('jobposts', maxJobPostsPerDay);
      const messages = await Promise.all(stubs.map((s) => getMessage(s.id)));
      const loaded: JobEmail[] = messages.map((msg) => {
        const body = getPlainTextBody(msg);
        return {
          id: msg.id,
          subject: getSubject(msg),
          body,
          urls: extractUrls(body),
          date: getInternalDate(msg),
        };
      });
      await setCached('jobposts', loaded);
      apply(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  function apply(data: JobEmail[]) {
    setEmails(data);
    onDataLoaded(data);
    setStatus('loaded');
  }

  useEffect(() => {
    if (emails.length === 0 || processedIds.length === 0) return;
    getConfig().then(({ staleJobDays }) => {
      setStaleJobDaysState(staleJobDays);
      const cutoff = Date.now() - staleJobDays * 24 * 60 * 60 * 1000;
      const stale = emails.filter(
        (e) => processedIds.includes(e.id) && new Date(e.date).getTime() < cutoff
      ).length;
      setStaleCount(stale);
    });
  }, [emails, processedIds]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function selectToday() {
    const { maxJobPostsPerDay } = await getConfig();
    const todayStr = new Date().toDateString();
    const todayEmails = emails.filter(
      (e) => e.urls.length > 0 &&
        new Date(e.date).toDateString() === todayStr &&
        !processedIds.includes(e.id)   // skip already processed
    );
    const pool = todayEmails.length > 0
      ? todayEmails
      : emails.filter((e) => e.urls.length > 0 && !processedIds.includes(e.id));
    setSelectedIds(pool.slice(0, maxJobPostsPerDay).map((e) => e.id));
  }

  async function handleAnalyze() {
    const selectedEmails = emails.filter((e) => selectedIds.includes(e.id));
    await markProcessed(...selectedIds);
    setProcessedIds((prev) => [...new Set([...prev, ...selectedIds])]);
    onAnalyze(selectedEmails);
  }

  function handleModeChange(mode: ProcessMode) {
    if (mode === 'daily') {
      setShowDailyConfirm(true);
    } else {
      setProcessMode('handpick');
      setSelectedIds([]);
      chrome.storage.local.set({ jobPostsProcessMode: 'handpick' });
    }
  }

  function confirmDaily() {
    setProcessMode('daily');
    chrome.storage.local.set({ jobPostsProcessMode: 'daily' });
    setShowDailyConfirm(false);
    selectToday();
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
      {/* Stale email cleanup nudge */}
      {staleCount > 0 && (
        <div style={s.staleBanner}>
          <span>ℹ {staleCount} processed post{staleCount !== 1 ? 's' : ''} older than {staleJobDays} days still in Gmail — delete them to keep fetches fast.</span>
          <a
            href="https://mail.google.com/mail/#search/label:jobposts"
            target="_blank"
            rel="noreferrer"
            style={s.staleLink}
            onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: 'https://mail.google.com/mail/#search/label:jobposts' }); }}
          >
            Open Gmail →
          </a>
        </div>
      )}

      {/* Mode selector */}
      <div style={s.modeRow}>
        <label style={s.modeLabel}>
          <input
            type="radio"
            name="processMode"
            checked={processMode === 'daily'}
            onChange={() => handleModeChange('daily')}
            style={s.radio}
          />
          <span>Daily Run</span>
          <span style={s.modeHint}>auto-select today's</span>
        </label>
        <label style={s.modeLabel}>
          <input
            type="radio"
            name="processMode"
            checked={processMode === 'handpick'}
            onChange={() => handleModeChange('handpick')}
            style={s.radio}
          />
          <span>Hand-pick</span>
          <span style={s.modeHint}>choose manually</span>
        </label>
      </div>

      {/* Action bar — only in Hand-pick mode */}
      {processMode === 'handpick' && (
        <div style={s.actionBar}>
          <span style={s.selectionHint}>
            {selectedIds.length === 0 ? 'Check posts below to analyze' : `${selectedIds.length} selected`}
          </span>
          <button
            style={{ ...s.analyzeAllBtn, ...(selectedIds.length === 0 || isAnalyzing ? s.analyzeAllDisabled : {}) }}
            disabled={selectedIds.length === 0 || isAnalyzing}
            onClick={handleAnalyze}
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze selected'}
          </button>
        </div>
      )}

      {/* Daily Run action bar */}
      {processMode === 'daily' && (
        <div style={s.actionBar}>
          <span style={s.selectionHint}>
            {selectedIds.length === 0 ? 'No new posts for today' : `${selectedIds.length} today's posts selected`}
          </span>
          <button
            style={{ ...s.analyzeAllBtn, ...(selectedIds.length === 0 || isAnalyzing ? s.analyzeAllDisabled : {}) }}
            disabled={selectedIds.length === 0 || isAnalyzing}
            onClick={handleAnalyze}
          >
            {isAnalyzing ? 'Analyzing…' : 'Run Daily'}
          </button>
        </div>
      )}

      {/* Job list */}
      <div>
        {emails.map((email) => {
          const checked = selectedIds.includes(email.id);
          const isExpanded = email.id === expandedId;
          const isDone = processedIds.includes(email.id);
          return (
            <div key={email.id} style={{ ...s.card, ...(checked ? s.cardChecked : {}), ...(isDone ? s.cardDone : {}) }}>
              <div style={s.cardHeader}>
                <label style={s.label}>
                  {processMode === 'handpick' && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(email.id)}
                      style={s.checkbox}
                    />
                  )}
                  <span style={{ ...s.subject, ...(checked ? s.subjectChecked : {}) }}>
                    {email.subject}
                  </span>
                </label>
                {isDone
                  ? <span style={s.doneBadge}>✓ Done</span>
                  : <span style={{ ...s.dateBadge, ...(new Date(email.date).toDateString() === new Date().toDateString() ? s.dateBadgeToday : {}) }}>
                      {formatDate(new Date(email.date))}
                    </span>
                }
                <button
                  style={s.expandBtn}
                  onClick={() => setExpandedId(isExpanded ? null : email.id)}
                  title={isExpanded ? 'Collapse' : 'Show URLs'}
                >
                  {email.urls.length > 0 ? `${email.urls.length} URL${email.urls.length !== 1 ? 's' : ''}` : '—'}
                  {' '}{isExpanded ? '▲' : '▼'}
                </button>
              </div>
              {isExpanded && (
                <div style={s.urlList}>
                  {email.urls.length === 0 ? (
                    <p style={s.noUrls}>No URLs found in this email.</p>
                  ) : (
                    email.urls.map((url, i) => (
                      <div key={i} style={s.urlRow}>
                        <span style={s.urlText} title={url}>{url}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily confirm modal */}
      {showDailyConfirm && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.modalTitle}>Enable Daily Run?</div>
            <p style={s.modalText}>
              Each time you open JobFit, today's job posts will be automatically selected and ready to analyze in one tap.
            </p>
            <div style={s.modalBtns}>
              <button style={s.modalCancel} onClick={() => setShowDailyConfirm(false)}>Cancel</button>
              <button style={s.modalOk} onClick={confirmDaily}>Yes, enable Daily Run</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  center: { color: '#888', textAlign: 'center', paddingTop: 40 },
  staleBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#e8f0fe', border: '1px solid #c5d8fb', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#1a56c4', lineHeight: 1.4 },
  staleLink: { color: '#1a73e8', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 },
  empty: { textAlign: 'center', paddingTop: 32, color: '#555', lineHeight: 1.6 },
  modeRow: { display: 'flex', gap: 16, marginBottom: 10, alignItems: 'center' },
  modeLabel: { display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  modeHint: { fontSize: 10, color: '#aaa', fontWeight: 400 },
  radio: { accentColor: '#1a73e8', cursor: 'pointer' },
  actionBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8, gap: 8,
  },
  selectionHint: { fontSize: 12, color: '#1a73e8', fontWeight: 600 },
  analyzeAllBtn: {
    fontSize: 12, padding: '5px 12px', border: 'none', borderRadius: 6,
    background: '#1a73e8', color: '#fff', cursor: 'pointer', fontWeight: 600,
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  analyzeAllDisabled: { background: '#ccc', cursor: 'not-allowed' },
  card: { border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  cardChecked: { borderColor: '#1a73e8', background: '#f8fbff' },
  cardHeader: { display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 6 },
  label: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 },
  checkbox: { width: 15, height: 15, accentColor: '#1a73e8', flexShrink: 0, cursor: 'pointer' },
  subject: {
    fontSize: 13, color: '#333', fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  subjectChecked: { color: '#1a73e8' },
  dateBadge: { fontSize: 10, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 },
  dateBadgeToday: { color: '#1a73e8', fontWeight: 600 },
  cardDone: { opacity: 0.5 },
  doneBadge: { fontSize: 10, color: '#2e7d32', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  expandBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, color: '#888', padding: '2px 4px', flexShrink: 0, whiteSpace: 'nowrap',
  },
  urlList: { borderTop: '1px solid #f0f0f0', padding: '6px 10px 10px' },
  noUrls: { fontSize: 12, color: '#888', margin: '4px 0' },
  urlRow: { padding: '3px 0', borderBottom: '1px solid #f5f5f5' },
  urlText: {
    fontSize: 11, color: '#555', display: 'block',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalBox: { background: '#fff', borderRadius: 8, padding: 20, maxWidth: 300, margin: '0 16px' },
  modalTitle: { fontWeight: 700, fontSize: 14, marginBottom: 10 },
  modalText: { fontSize: 12, color: '#444', lineHeight: 1.6, marginBottom: 16 },
  modalBtns: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  modalCancel: { padding: '6px 12px', fontSize: 12, background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' },
  modalOk: { padding: '6px 12px', fontSize: 12, background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' },
};
