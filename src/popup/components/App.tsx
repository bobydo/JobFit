import { useEffect, useState } from 'react';
import { labelExists } from '@gmail/gmail-client';
import OnboardingScreen from './OnboardingScreen';
import ResumesTab from './ResumesTab';
import JobPostsTab from './JobPostsTab';
import ResultsTab from './ResultsTab';

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

  async function checkLabels() {
    setSetup({ status: 'checking' });
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out after 10s — check OAuth client ID and Gmail API is enabled')), 10000)
      );
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

      {showSettings ? (
        <div style={styles.placeholder}>Settings — coming in Stage 7</div>
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
            {activeTab === 'resumes' && <ResumesTab />}
            {activeTab === 'jobposts' && <JobPostsTab />}
            {activeTab === 'results' && <ResultsTab />}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button style={styles.refreshBtn} onClick={checkLabels}>↺ Refresh</button>
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
  tabs: { display: 'flex', borderBottom: '1px solid #e5e5e5' },
  tab: { flex: 1, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#555' },
  tabActive: { borderBottom: '2px solid #1a73e8', color: '#1a73e8', fontWeight: 600 },
  content: { flex: 1, overflowY: 'auto', padding: 12 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #e5e5e5' },
  refreshBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13 },
  placeholder: { padding: 16, color: '#888', textAlign: 'center' },
};
