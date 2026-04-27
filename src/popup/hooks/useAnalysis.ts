import { useEffect, useState } from 'react';
import { getConfig } from '@storage/config-store';
import { getAnalysisResults, saveAnalysisResults } from '@storage/cache-store';
import { fetchJobContent, analyzePair } from '@analyzer/match-analyzer';
import { ANALYSIS_POPUP_WIDTH, ANALYSIS_POPUP_HEIGHT, ANALYSIS_POPUP_MARGIN } from '../../config';
import type { Resume, JobEmail, AnalysisResult, LoginWallResult } from '../types';
import type { AppConfig } from '../../storage/config-store';

function getConfigError(cfg: AppConfig): string | null {
  if (['groq', 'anthropic', 'openai'].includes(cfg.mode) && !cfg.apiKey)
    return 'Please add your API key in Settings.';
  if (cfg.mode === 'jobfit-cloud' && !cfg.subscriptionToken)
    return 'Please add your subscription token in Settings.';
  return null;
}

export function useAnalysis(isStandalone: boolean, onTabChange: (tab: 'results') => void) {
  const [resultsData,     setResultsData]     = useState<AnalysisResult[]>([]);
  const [loginWalls,      setLoginWalls]      = useState<LoginWallResult[]>([]);
  const [isAnalyzing,     setIsAnalyzing]     = useState(false);
  const [analyzeError,    setAnalyzeError]    = useState<string | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => { getAnalysisResults().then(setResultsData); }, []);

  // Standalone window: read pendingAnalysis from storage and start analysis
  useEffect(() => {
    if (!isStandalone) return;
    chrome.storage.local.get('pendingAnalysis', (stored) => {
      if (!stored.pendingAnalysis) return;
      chrome.storage.local.remove('pendingAnalysis');
      const { selectedJobs, resumes } = stored.pendingAnalysis as { selectedJobs: JobEmail[]; resumes: Resume[] };
      onTabChange('results');
      runAnalysis(selectedJobs, resumes);
    });
  }, []);

  async function runAnalysis(selectedJobs: JobEmail[], activeResumes: Resume[]) {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setLoginWalls([]);

    const cfg    = await getConfig();
    const cfgErr = getConfigError(cfg);
    if (cfgErr) { setAnalyzeError(cfgErr); setIsAnalyzing(false); return; }

    const existing  = await getAnalysisResults();
    const resultMap = new Map(existing.map((r) => [`${r.jobEmailId}::${r.jobUrl}::${r.resumeId}`, r]));
    const totalUrls = selectedJobs.reduce((sum, j) => sum + j.urls.length, 0);
    let doneUrls = 0;
    setAnalyzeProgress({ done: 0, total: totalUrls });

    const errors: string[] = [];
    for (const job of selectedJobs) {
      for (const url of job.urls) {
        doneUrls++;
        setAnalyzeProgress({ done: doneUrls, total: totalUrls });
        const page = await fetchJobContent(url).catch(() => null);
        if (page && 'loginRequired' in page) {
          setLoginWalls(prev => [...prev, { jobUrl: url, domain: page.domain }]);
          continue;
        }
        const jobIdMatch = url.match(/\/(\d+)\//);
        const subject    = page?.title ?? (jobIdMatch ? `${job.subject} #${jobIdMatch[1]}` : job.subject);
        const contentJob: JobEmail = { id: job.id, subject, body: page?.body ?? job.body, urls: [url], date: job.date };

        for (const resume of activeResumes) {
          try {
            const result = await analyzePair(resume, contentJob, cfg);
            resultMap.set(`${job.id}::${url}::${resume.id}`, result);
            const merged = Array.from(resultMap.values());
            await saveAnalysisResults(merged);
            setResultsData([...merged]);
          } catch (err) {
            errors.push(`${url} × ${resume.subject}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    }
    if (errors.length > 0) setAnalyzeError(errors.join('\n'));
    setAnalyzeProgress(null);
    setIsAnalyzing(false);
    // When analysis finishes, analysisWindowId is cleared 
    // so the next "Analyze selected" always opens a fresh popup
    chrome.storage.local.remove('analysisWindowId');
  }

  async function handleAnalyze(
    selectedJobs: JobEmail[],
    activeResumeIds: string[],
    resumesData: Resume[] | null,
  ) {
    if (activeResumeIds.length === 0) {
      setAnalyzeError('No resume selected — go to the Resumes tab and select at least one.');
      return;
    }
    if (!resumesData?.length) {
      setAnalyzeError('Resume data could not be loaded — please go to the Resumes tab and re-select your resume.');
      return;
    }
    const activeResumes = resumesData.filter((r) => activeResumeIds.includes(r.id));
    const cfg    = await getConfig();
    const cfgErr = getConfigError(cfg);
    if (cfgErr) { setAnalyzeError(cfgErr); return; }

    const currentWin = await chrome.windows.getCurrent();
    const { analysisWindowId } = await chrome.storage.local.get('analysisWindowId') as { analysisWindowId?: number };
    if (analysisWindowId && analysisWindowId !== currentWin.id) {
      try {
        await chrome.windows.get(analysisWindowId);
        chrome.windows.update(analysisWindowId, { focused: true });
        return;
      } catch { /* window was closed — fall through */ }
    }

    await new Promise<void>((resolve) =>
      chrome.storage.local.set({ pendingAnalysis: { selectedJobs, resumes: activeResumes } }, resolve)
    );
    const popupUrl = chrome.runtime.getURL('src/popup/popup.html') + '?analyze';
    const left     = window.screen.availWidth - ANALYSIS_POPUP_WIDTH - ANALYSIS_POPUP_MARGIN;
    const top      = Math.round((window.screen.availHeight - ANALYSIS_POPUP_HEIGHT) / 2);
    const win      = await new Promise<chrome.windows.Window>((resolve) =>
      chrome.windows.create({ url: popupUrl, type: 'popup', width: ANALYSIS_POPUP_WIDTH, height: ANALYSIS_POPUP_HEIGHT, left, top }, (w) => resolve(w!))
    );
    await new Promise<void>((resolve) => chrome.storage.local.set({ analysisWindowId: win.id }, resolve));
    window.close();
  }

  async function clearResults() {
    setResultsData([]);
    setLoginWalls([]);
    setAnalyzeError(null);
    await saveAnalysisResults([]);
  }

  return { resultsData, loginWalls, isAnalyzing, analyzeError, analyzeProgress, handleAnalyze, clearResults };
}
