import React, { useState } from 'react';
import { useAppSetup }        from '../hooks/useAppSetup';
import { useResumeSelection } from '../hooks/useResumeSelection';
import { useAnalysis }        from '../hooks/useAnalysis';
import OnboardingScreen from './OnboardingScreen';
import ResumesTab       from './ResumesTab';
import JobPostsTab      from './JobPostsTab';
import ResultsTab       from './ResultsTab';
import SettingsPanel    from './SettingsPanel/SettingsPanel';
import Header           from './Header';
import type { JobEmail } from '../types';

type Tab = 'resumes' | 'jobposts' | 'results';

export default function App() {
  const isStandalone = new URLSearchParams(window.location.search).has('analyze');

  const [activeTab,    setActiveTab]    = useState<Tab>('resumes');
  const [showSettings, setShowSettings] = useState(false);
  const [focusPro,     setFocusPro]     = useState(false);
  const [jobEmailsData, setJobEmailsData] = useState<JobEmail[] | null>(null);

  const {
    setup, checkLabels, handleSignOut,
    gmailEmail, maxResumes, mode,
    apiStatus, sitesOk, sitesWarn, siteChecking,
    recheckApi,
  } = useAppSetup(isStandalone);

  const {
    activeResumeIds, setActiveResumeIds,
    resumesData, setResumesData,
    storageReady, toggleResume,
  } = useResumeSelection(maxResumes);

  const {
    resultsData, loginWalls,
    isAnalyzing, analyzeError, analyzeProgress,
    handleAnalyze, clearResults,
  } = useAnalysis(isStandalone, setActiveTab);

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
      <Header
        sitesOk={sitesOk} sitesWarn={sitesWarn} siteChecking={siteChecking}
        apiOk={apiStatus === 'ok'} apiWarn={apiStatus === 'error'} apiChecking={apiStatus === 'checking'}
        loginWalls={loginWalls}
        gmailEmail={gmailEmail}
        showSettings={showSettings}
        onSignOut={handleSignOut}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {isAnalyzing && (
        <div style={styles.closeBar}>
          <span style={styles.closeBarText}>[<span style={styles.closeBarX} onClick={() => window.close()}>X</span>] to close, otherwise leave it open</span>
        </div>
      )}

      {showSettings ? (
        <SettingsPanel focusPro={focusPro} onClose={() => { setShowSettings(false); setFocusPro(false); recheckApi(); }} />
      ) : (
        <>
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
                onAnalyze={(jobs) => handleAnalyze(jobs, activeResumeIds, resumesData)}
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
                isPro={mode === 'jobfit-cloud'}
                onClear={clearResults}
                onUpgrade={() => { setFocusPro(true); setShowSettings(true); }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container:   { display: 'flex', flexDirection: 'column', height: '100%' },
  center:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, padding: 16, textAlign: 'center' },
  tabs:        { display: 'flex', borderBottom: '2px solid #e5e5e5' },
  tab:         { flex: 1, padding: '8px 0', background: 'none', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: 13, color: '#888', marginBottom: -2 },
  tabActive:   { borderBottom: '3px solid #1a73e8', color: '#1a73e8', fontWeight: 600, background: '#f0f6ff' },
  tabDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  content:     { flex: 1, overflowY: 'auto', padding: 12 },
  closeBar:    { borderTop: '1px solid #e5e5e5', padding: '6px 14px', background: '#fff8e1', textAlign: 'center' },
  closeBarText: { fontSize: 12, color: '#555' },
  closeBarX:   { fontWeight: 700, color: '#c62828', cursor: 'pointer' },
};
