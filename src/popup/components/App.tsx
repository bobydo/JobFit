import { useEffect, useState } from 'react';
import { labelExists } from '@gmail/gmail-client';
import { clearCached, getAnalysisResults, saveAnalysisResults, clearAnalysisResults } from '@storage/cache-store';
import { getConfig } from '@storage/config-store';
import { analyzeUrl, analyzePair } from '@analyzer/match-analyzer';
import OnboardingScreen from './OnboardingScreen';
import ResumesTab from './ResumesTab';
import JobPostsTab from './JobPostsTab';
import ResultsTab from './ResultsTab';
import SettingsPanel from './SettingsPanel';
import type { Resume, JobEmail, AnalysisResult } from '../types';

type Tab = 'resumes' | 'jobposts' | 'results';

type SetupState =
  | { status: 'checking' }
  | { status: 'needs_setup'; missingLabels: string[] }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export default function App() {
  const [setup, setSetup] = useState<SetupState>({ status: 'checking' });
  const [activeTab, setActiveTab] = useState<Tab>('resumes');
  const [showSettings, setShowSettings] = useState(false);
  const [activeResumeIds, setActiveResumeIds] = useState<string[]>([]);
  const [resumesData, setResumesData] = useState<Resume[] | null>(null);
  const [jobEmailsData, setJobEmailsData] = useState<JobEmail[] | null>(null);
  const [maxResumes, setMaxResumes] = useState(2);
  const [storageReady, setStorageReady] = useState(false);
  const [resultsData, setResultsData] = useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  // True when reopened as a standalone window to keep analysis alive
  const isStandalone = new URLSearchParams(window.location.search).has('analyze');

  useEffect(() => {
    chrome.storage.local.get('activeResumeIds', (stored) => {
      if (stored.activeResumeIds?.length) setActiveResumeIds(stored.activeResumeIds);
      setStorageReady(true);
    });
    getConfig().then((cfg) => setMaxResumes(cfg.maxResumes));
    getAnalysisResults().then(setResultsData);

    // Standalone window: load pending jobs+resumes from storage and start immediately
    if (isStandalone) {
      chrome.storage.local.get('pendingAnalysis', (stored) => {
        if (!stored.pendingAnalysis) return;
        chrome.storage.local.remove('pendingAnalysis');
        const { selectedJobs, resumes } = stored.pendingAnalysis as { selectedJobs: JobEmail[]; resumes: Resume[] };
        setActiveTab('results');
        runAnalysis(selectedJobs, resumes);
      });
    }
  }, []);

  async function runAnalysis(selectedJobs: JobEmail[], activeResumes: Resume[]) {
    setIsAnalyzing(true);
    setAnalyzeError(null);

    const cfg = await getConfig();
    if (cfg.mode !== 'ollama') {
      setAnalyzeError('Please configure Ollama in Settings before analyzing.');
      setIsAnalyzing(false);
      return;
    }
    const baseUrl = cfg.ollamaBaseUrl ?? 'http://localhost:11434';
    const model = cfg.ollamaModel ?? 'qwen3:8b';

    const existing = await getAnalysisResults();
    const resultMap = new Map(existing.map((r) => [`${r.jobEmailId}::${r.jobUrl}::${r.resumeId}`, r]));

    const totalUrls = selectedJobs.reduce((sum, j) => sum + j.urls.length, 0);
    let doneUrls = 0;
    setAnalyzeProgress({ done: 0, total: totalUrls });

    const errors: string[] = [];
    for (const job of selectedJobs) {
      for (const url of job.urls) {
        for (const resume of activeResumes) {
          try {
            let result: AnalysisResult | null = null;
            try {
              result = await analyzeUrl(resume, url, job.id, baseUrl, model);
            } catch (err) {
              console.warn('[JobFit] URL fetch failed:', url, err);
            }
            if (!result) {
              const jobIdMatch = url.match(/\/(\d+)\//);
              const subject = jobIdMatch ? `${job.subject} #${jobIdMatch[1]}` : job.subject;
              const fakeJob: JobEmail = { id: job.id, subject, body: job.body, urls: [url], date: job.date };
              result = await analyzePair(resume, fakeJob, baseUrl, model);
            }
            const key = `${job.id}::${url}::${resume.id}`;
            resultMap.set(key, result);
            const merged = Array.from(resultMap.values());
            await saveAnalysisResults(merged);
            setResultsData([...merged]);
          } catch (err) {
            console.error('[JobFit] pair failed:', err);
            errors.push(`${url} × ${resume.subject}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        doneUrls++;
        setAnalyzeProgress({ done: doneUrls, total: totalUrls });
      }
    }
    if (errors.length > 0) setAnalyzeError(errors.join('\n'));
    setAnalyzeProgress(null);
    setIsAnalyzing(false);
  }

  async function handleAnalyze(selectedJobs: JobEmail[]) {
    if (!resumesData || resumesData.length === 0 || activeResumeIds.length === 0) {
      setAnalyzeError('No resumes selected. Go to the Resumes tab and select at least one.');
      return;
    }
    const activeResumes = resumesData.filter((r) => activeResumeIds.includes(r.id));
    const cfg = await getConfig();
    if (cfg.mode !== 'ollama') {
      setAnalyzeError('Please configure Ollama in Settings before analyzing.');
      return;
    }

    // Save jobs + full resume objects, then reopen as standalone window that won't close on blur
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ pendingAnalysis: { selectedJobs, resumes: activeResumes } }, resolve)
    );
    const popupUrl = chrome.runtime.getURL('src/popup/popup.html') + '?analyze';
    chrome.windows.create({ url: popupUrl, type: 'popup', width: 440, height: 620 });
    window.close();
  }

  // Persist selection — only after storage has been restored
  useEffect(() => {
    if (!storageReady) return;
    if (activeResumeIds.length > 0) {
      chrome.storage.local.set({ activeResumeIds });
    }
  }, [activeResumeIds, storageReady]);

  function toggleResume(id: string) {
    setActiveResumeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxResumes) return prev;
      return [...prev, id];
    });
  }

  async function checkLabels() {
    setSetup({ status: 'checking' });
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out after 10s — check OAuth client ID and Gmail API is enabled')), 10000)
      );
      //labelExists is a function of gmail-client.ts 
      //https://gmail.googleapis.com/gmail/v1/users/me/labels API to check if label exists
      const [hasResumes, hasJobposts] = await Promise.race([
        Promise.all([labelExists('resumes'), labelExists('jobposts')]),
        timeout,
      ]) as [boolean, boolean];
      const missing: string[] = [];
      if (!hasResumes) missing.push('resumes');
      if (!hasJobposts) missing.push('jobposts');
      setSetup(missing.length > 0 ? { status: 'needs_setup', missingLabels: missing } : { status: 'ready' });
    } catch (err) {
      setSetup({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleRefresh() {
    await clearCached('resumes', 'jobposts');
    await clearAnalysisResults();
    chrome.storage.local.remove('activeResumeIds');
    setResumesData(null);
    setJobEmailsData(null);
    setActiveResumeIds([]);
    setResultsData([]);
    setAnalyzeError(null);
    await checkLabels();
  }

  useEffect(() => { checkLabels(); }, []);

  if (setup.status === 'checking') {
    return <div style={styles.center}>Checking Gmail labels…</div>;
  }

  if (setup.status === 'error') {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00', marginBottom: 8 }}>{setup.message}</p>
        <button onClick={checkLabels}>Retry</button>
      </div>
    );
  }

  if (setup.status === 'needs_setup') {
    return <OnboardingScreen missingLabels={setup.missingLabels} onContinue={checkLabels} />;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.logo}>JobFit</span>
        <button style={styles.iconBtn} onClick={() => setShowSettings(!showSettings)}>⚙</button>
      </div>

      {isAnalyzing && (
        <div style={styles.closeBar}>
          <span style={styles.closeBarText}>[<span style={styles.closeBarX} onClick={() => window.close()}>X</span>] to close, otherwise leave it open</span>
        </div>
      )}

      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : (
        <>
          {/* Tabs */}
          <div style={styles.tabs}>
            {(['resumes', 'jobposts', 'results'] as Tab[]).map((t) => (
              <button
                key={t}
                style={{ ...styles.tab, ...(activeTab === t ? styles.tabActive : {}) }}
                onClick={() => setActiveTab(t)}
              >
                {t === 'resumes' ? 'Resumes' : t === 'jobposts' ? 'Job Posts' : 'Results'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={styles.content}>
            {activeTab === 'resumes' && storageReady && (
              <ResumesTab
                activeResumeIds={activeResumeIds}
                onToggle={toggleResume}
                onInitIds={setActiveResumeIds}
                cachedData={resumesData}
                onDataLoaded={setResumesData}
                maxResumes={maxResumes}
              />
            )}
            {activeTab === 'jobposts' && (
              <JobPostsTab
                cachedData={jobEmailsData}
                onDataLoaded={setJobEmailsData}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
              />
            )}
            {activeTab === 'results' && (
              <ResultsTab
                results={resultsData}
                isAnalyzing={isAnalyzing}
                progress={analyzeProgress}
                error={analyzeError}
              />
            )}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button style={styles.refreshBtn} onClick={handleRefresh}>↺ Refresh</button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, padding: 16, textAlign: 'center' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #e5e5e5' },
  logo: { fontWeight: 700, fontSize: 16 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: 2 },
  tabs: { display: 'flex', borderBottom: '2px solid #e5e5e5' },
  tab: { flex: 1, padding: '8px 0', background: 'none', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: 13, color: '#888', marginBottom: -2 },
  tabActive: { borderBottom: '3px solid #1a73e8', color: '#1a73e8', fontWeight: 600, background: '#f0f6ff' },
  content: { flex: 1, overflowY: 'auto', padding: 12 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #e5e5e5' },
  refreshBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13 },
  placeholder: { padding: 16, color: '#888', textAlign: 'center' },
  closeBar: { borderTop: '1px solid #e5e5e5', padding: '6px 14px', background: '#fff8e1', textAlign: 'center' },
  closeBarText: { fontSize: 12, color: '#555' },
  closeBarX: { fontWeight: 700, color: '#c62828', cursor: 'pointer' },
};
