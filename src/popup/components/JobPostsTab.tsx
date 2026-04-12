import { useEffect, useState } from 'react';
import { listMessages, getMessage, getSubject, getPlainTextBody, getBodyForUrlExtraction, getInternalDate, MessageStub } from '@gmail/gmail-client';
import { getCached, setCached, getProcessedIds, markProcessed } from '@storage/cache-store';
import { getConfig } from '@storage/config-store';
import { extractCandidateUrls } from '@utils/job_email/job-page-fetcher';
import type { JobEmail } from '../types';
import { jobPostsStyles as s } from './shared.styles';

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
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [staleCount, setStaleCount] = useState(0);
  const [staleJobDays, setStaleJobDaysState] = useState(10);

  useEffect(() => {
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
        apply(stored);
        return;
      }
      const { maxJobPosts } = await getConfig();
      const stubs = await listMessages('jobposts', maxJobPosts);
      const messages: Awaited<ReturnType<typeof getMessage>>[] = await fetchInBatches(stubs);
      const loaded: JobEmail[] = messages.map((msg) => {
        const body = getPlainTextBody(msg);
        return {
          id: msg.id,
          subject: getSubject(msg),
          body,
          urls: extractCandidateUrls(getBodyForUrlExtraction(msg)),
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

  /*
  Promise.all fires all Gmail API requests simultaneously
  if you have 20 job posts, it sends 20 concurrent requests at once. 
  Gmail's API rate limit is per-user concurrent requests, so it throws 429.
  */
  async function fetchInBatches(stubs: MessageStub[]) {
    const messages: Awaited<ReturnType<typeof getMessage>>[] = [];
    for (let i = 0; i < stubs.length; i += 5) {
      const batch = await Promise.all(stubs.slice(i, i + 5).map((s) => getMessage(s.id)));
      messages.push(...batch);
    }
    return messages;
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

  async function handleAnalyze() {
    const selectedEmails = emails.filter((e) => selectedIds.includes(e.id));
    await markProcessed(...selectedIds);
    setProcessedIds((prev) => [...new Set([...prev, ...selectedIds])]);
    onAnalyze(selectedEmails);
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

      {/* Action bar */}
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
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(email.id)}
                    style={s.checkbox}
                  />
                  <span style={{ ...s.subject, ...(checked ? s.subjectChecked : {}) }}>
                    {email.subject}
                  </span>
                </label>
                {isDone && <span style={s.doneBadge}>✓ Done</span>}
                <span style={{ ...s.dateBadge, ...(new Date(email.date).toDateString() === new Date().toDateString() ? s.dateBadgeToday : {}) }}>
                  {formatDate(new Date(email.date))}
                </span>
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
    </div>
  );
}

