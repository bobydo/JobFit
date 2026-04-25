import React, { useEffect, useState } from 'react';
import { labelExists, getGmailProfile } from '@gmail/gmail-client';
import { getAuthToken, removeAuthToken } from '@gmail/gmail-auth';
import { getAnalysisResults, saveAnalysisResults } from '@storage/cache-store';
import { getUploadedResumes } from '@storage/resume-store';
import { getConfig, saveConfig } from '@storage/config-store';
import { fetchJobContent, analyzePair } from '@analyzer/match-analyzer';
import OnboardingScreen from './OnboardingScreen';
import ResumesTab from './ResumesTab';
import JobPostsTab from './JobPostsTab';
import ResultsTab from './ResultsTab';
import SettingsPanel from './SettingsPanel/SettingsPanel';
import Header from './Header';
import type { Resume, JobEmail, AnalysisResult, LoginWallResult } from '../types';
import { ANALYSIS_POPUP_WIDTH, ANALYSIS_POPUP_HEIGHT, ANALYSIS_POPUP_MARGIN, WORKER_URL, AUTH_REQUIRED_DOMAINS } from '../../config';
import { recheckSites } from '@utils/SettingsPanel/siteSignIn';
import { checkApiReady } from '@utils/SettingsPanel/APICall';

type Tab = 'resumes' | 'jobposts' | 'results';

type SetupState =
  | { status: 'checking' }
  | { status: 'needs_setup'; missingLabels: string[] }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export default function App() {
  // True when reopened as a standalone window to keep analysis alive
  const isStandalone = new URLSearchParams(window.location.search).has('analyze');
  const [setup, setSetup] = useState<SetupState>({ status: isStandalone ? 'ready' : 'checking' });
  const [activeTab, setActiveTab] = useState<Tab>('resumes');
  const [showSettings, setShowSettings] = useState(false);
  const [activeResumeIds, setActiveResumeIds] = useState<string[]>([]);
  const [resumesData, setResumesData] = useState<Resume[] | null>(null);
  const [jobEmailsData, setJobEmailsData] = useState<JobEmail[] | null>(null);
  const [maxResumes, setMaxResumes] = useState(2);
  const [storageReady, setStorageReady] = useState(false);
  const [resultsData, setResultsData] = useState<AnalysisResult[]>([]);
  const [loginWalls, setLoginWalls] = useState<LoginWallResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);
  const [gmailEmail, setGmailEmail] = useState('');
  const [siteStatus, setSiteStatus] = useState<Record<string, boolean | null>>({});
  const [siteChecking, setSiteChecking] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    chrome.storage.local.get('activeResumeIds', (stored) => {
      if (stored.activeResumeIds?.length) setActiveResumeIds(stored.activeResumeIds);
      setStorageReady(true);
    });
    getUploadedResumes().then((stored) => { if (stored.length) setResumesData(stored); });
    getConfig().then(async (cfg) => {
      setMaxResumes(cfg.maxResumes);
      const ok = await checkApiReady(cfg);
      setApiStatus(ok ? 'ok' : 'error');
    });
    recheckSites(setSiteChecking, setSiteStatus);
    getAnalysisResults().then(setResultsData);
    getGmailProfile().then((email) => { if (email) setGmailEmail(email); }).catch(() => {});

    // Standalone window (opened by handleAnalyze with ?analyze param):
    // reads pendingAnalysis from storage, switches to Results tab, starts analysis.
    // setActiveTab('results') here is what makes the Results tab appear on open.
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

  async function handleSignOut() {
    try {
      const token = await getAuthToken(false);
      await removeAuthToken(token);
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
    } catch { /* no active token */ }
    // Reset so email is re-collected on next sign-in
    await saveConfig({ emailSignupShown: false, emailSignupAddress: undefined });
    window.close();
  }

  function getConfigError(cfg: Awaited<ReturnType<typeof getConfig>>): string | null {
    if (['groq', 'anthropic', 'openai'].includes(cfg.mode) && !cfg.apiKey)
      return 'Please add your API key in Settings.';
    if (cfg.mode === 'jobfit-cloud' && !cfg.subscriptionToken)
      return 'Please add your subscription token in Settings.';
    return null;
  }

  async function runAnalysis(selectedJobs: JobEmail[], activeResumes: Resume[]) {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setLoginWalls([]);

    const cfg = await getConfig();
    const cfgErr = getConfigError(cfg);
    if (cfgErr) {
      setAnalyzeError(cfgErr);
      setIsAnalyzing(false);
      return;
    }

    const existing = await getAnalysisResults();
    const resultMap = new Map(existing.map((r) => [`${r.jobEmailId}::${r.jobUrl}::${r.resumeId}`, r]));

    // Progress counts URLs (each URL = one job posting page to analyze).
    // "1/6 jobs" means 1 URL processed out of 6 total across all selected emails.
    // DO NOT change this to count job emails — a single email can have 6 URLs.
    const totalUrls = selectedJobs.reduce((sum, j) => sum + j.urls.length, 0);
    let doneUrls = 0;
    setAnalyzeProgress({ done: 0, total: totalUrls });

    const errors: string[] = [];
    for (const job of selectedJobs) {
      for (const url of job.urls) {
        // Increment per URL so the counter advances as each posting is processed
        doneUrls++;
        setAnalyzeProgress({ done: doneUrls, total: totalUrls });
        // Fetch job page ONCE for all resumes — avoids duplicate tab opens and inconsistent results
        const page = await fetchJobContent(url).catch(() => null);
        if (page && 'loginRequired' in page) {
          setLoginWalls(prev => [...prev, { jobUrl: url, domain: page.domain }]);
          continue;
        }
        const jobIdMatch = url.match(/\/(\d+)\//);
        const subject = page?.title ?? (jobIdMatch ? `${job.subject} #${jobIdMatch[1]}` : job.subject);
        const body = page?.body ?? job.body;
        const contentJob: JobEmail = { id: job.id, subject, body, urls: [url], date: job.date };

        for (const resume of activeResumes) {
          try {
            const result = await analyzePair(resume, contentJob, cfg);
            const key = `${job.id}::${url}::${resume.id}`;
            resultMap.set(key, result);
            // Save + update UI after EVERY resume-URL pair so results appear one-by-one.
            // DO NOT move this outside the loop — batching kills the live update behavior.
            const merged = Array.from(resultMap.values());
            await saveAnalysisResults(merged);
            setResultsData([...merged]);
          } catch (err) {
            console.error('[JobFit] pair failed:', err);
            errors.push(`${url} × ${resume.subject}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
    if (errors.length > 0) setAnalyzeError(errors.join('\n'));
    setAnalyzeProgress(null);
    setIsAnalyzing(false);
  }

  async function handleAnalyze(selectedJobs: JobEmail[]) {
    if (activeResumeIds.length === 0) {
      setAnalyzeError('No resume selected — go to the Resumes tab and select at least one.');
      return;
    }
    if (!resumesData || resumesData.length === 0) {
      setAnalyzeError('Resume data could not be loaded — please go to the Resumes tab and re-select your resume.');
      return;
    }
    const activeResumes = resumesData.filter((r) => activeResumeIds.includes(r.id));
    const cfg = await getConfig();
    const cfgErr = getConfigError(cfg);
    if (cfgErr) {
      setAnalyzeError(cfgErr);
      return;
    }

    // ⚠️ HOW "ANALYZE SELECTED" JUMPS TO RESULTS TAB — DO NOT BREAK THIS FLOW:
    //
    // The browser popup (type:'popup' in manifest) closes itself when it loses focus,
    // which would kill a long-running analysis mid-way. To prevent that, we:
    //   1. Save selected jobs + resumes to storage under 'pendingAnalysis'
    //   2. Open a NEW standalone window (type:'popup' via chrome.windows.create)
    //      with '?analyze' in the URL — standalone windows stay open on blur
    //   3. Close this popup (window.close())
    //   4. The new window's useEffect detects isStandalone (?analyze param),
    //      reads 'pendingAnalysis' from storage, calls setActiveTab('results'),
    //      then starts runAnalysis — this is what switches to the Results tab.
    //
    // If you remove window.close(), move the logic inline, or skip the ?analyze
    // param, the Results tab switch and/or the stay-open behavior will break.
    // Reuse existing analysis window if still open
    const currentWin = await chrome.windows.getCurrent();
    const { analysisWindowId } = await chrome.storage.local.get('analysisWindowId') as { analysisWindowId?: number };
    if (analysisWindowId && analysisWindowId !== currentWin.id) {
      try {
        await chrome.windows.get(analysisWindowId);           // throws if window was closed
        chrome.windows.update(analysisWindowId, { focused: true });
        return;
      } catch {
        // window was closed by user — fall through to create a new one
      }
    }
    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ pendingAnalysis: { selectedJobs, resumes: activeResumes } }, resolve)
    );
    const popupUrl = chrome.runtime.getURL('src/popup/popup.html') + '?analyze';
    // Position on the RIGHT edge so Chrome's download panel (appears on the left of the browser)
    // doesn't overlap the analysis window.
    const left = window.screen.availWidth - ANALYSIS_POPUP_WIDTH - ANALYSIS_POPUP_MARGIN;
    const top = Math.round((window.screen.availHeight - ANALYSIS_POPUP_HEIGHT) / 2);
    const win = await new Promise<chrome.windows.Window>((resolve) =>
      chrome.windows.create({ url: popupUrl, type: 'popup', width: ANALYSIS_POPUP_WIDTH, height: ANALYSIS_POPUP_HEIGHT, left, top }, (w) => resolve(w!))
    );
    await new Promise<void>((resolve) => chrome.storage.local.set({ analysisWindowId: win.id }, resolve));
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
        setTimeout(() => reject(new Error('Timed out — check OAuth client ID and Gmail API is enabled')), 60000)
      );
      //labelExists is a function of gmail-client.ts 
      //https://gmail.googleapis.com/gmail/v1/users/me/labels API to check if label exists
      const hasJobposts = await Promise.race([
        labelExists('jobposts'),
        timeout,
      ]) as boolean;
      const missing: string[] = [];
      if (!hasJobposts) missing.push('jobposts');
      setSetup(missing.length > 0 ? { status: 'needs_setup', missingLabels: missing } : { status: 'ready' });
    } catch (err) {
      setSetup({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  useEffect(() => { if (!isStandalone) checkLabels(); }, []);

  // Silently submit email to Google Form via Cloudflare Worker once labels are confirmed ready
  useEffect(() => {
    if (setup.status !== 'ready' || isStandalone) return;
    getConfig().then(async (cfg) => {
      if (cfg.emailSignupShown) return;
      const email = await getGmailProfile().catch(() => '');
      if (!email) return;
      fetch(`${WORKER_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {}); // fire and forget
      saveConfig({ emailSignupShown: true, emailSignupAddress: email });
    });
  }, [setup.status]);

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
      {(() => {
        const siteVals  = Object.keys(AUTH_REQUIRED_DOMAINS).map(h => siteStatus[h]);
        const sitesOk   = siteVals.length > 0 && siteVals.every(v => v === true);
        const sitesWarn = siteVals.some(v => v === false);
        const apiOk      = apiStatus === 'ok';
        const apiWarn    = apiStatus === 'error';
        const apiChecking = apiStatus === 'checking';
        return (
          <Header
            sitesOk={sitesOk} sitesWarn={sitesWarn} siteChecking={siteChecking}
            apiOk={apiOk} apiWarn={apiWarn} apiChecking={apiChecking}
            loginWalls={loginWalls}
            gmailEmail={gmailEmail}
            showSettings={showSettings}
            onSignOut={handleSignOut}
            onToggleSettings={() => setShowSettings(!showSettings)}
            onOpenSettings={() => setShowSettings(true)}
          />
        );
      })()}

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
            {(['resumes', 'jobposts', 'results'] as Tab[]).map((t) => {
              const blocked = t !== 'resumes' && activeResumeIds.length === 0;
              return (
                <button
                  key={t}
                  style={{ ...styles.tab, ...(activeTab === t ? styles.tabActive : {}), ...(blocked ? styles.tabDisabled : {}) }}
                  disabled={blocked}
                  onClick={() => setActiveTab(t)}
                  title={blocked ? 'Select at least one resume first' : undefined}
                >
                  {t === 'resumes' ? 'Resumes' : t === 'jobposts' ? 'Job Posts' : 'Results'}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={styles.content}>
            {activeTab === 'resumes' && storageReady && (
              <ResumesTab
                activeResumeIds={activeResumeIds}
                onToggle={toggleResume}
                cachedData={resumesData}
                onDataLoaded={setResumesData}
                onResumeDeleted={(id) => setActiveResumeIds((prev) => prev.filter((x) => x !== id))}
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
                loginWalls={loginWalls}
                isAnalyzing={isAnalyzing}
                progress={analyzeProgress}
                error={analyzeError}
              />
            )}
          </div>

        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, padding: 16, textAlign: 'center' },
  tabs: { display: 'flex', borderBottom: '2px solid #e5e5e5' },
  tab: { flex: 1, padding: '8px 0', background: 'none', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: 13, color: '#888', marginBottom: -2 },
  tabActive: { borderBottom: '3px solid #1a73e8', color: '#1a73e8', fontWeight: 600, background: '#f0f6ff' },
  content: { flex: 1, overflowY: 'auto', padding: 12 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #e5e5e5' },
  placeholder: { padding: 16, color: '#888', textAlign: 'center' },
  closeBar: { borderTop: '1px solid #e5e5e5', padding: '6px 14px', background: '#fff8e1', textAlign: 'center' },
  closeBarText: { fontSize: 12, color: '#555' },
  closeBarX: { fontWeight: 700, color: '#c62828', cursor: 'pointer' },
  tabDisabled: { opacity: 0.35, cursor: 'not-allowed' },
};
