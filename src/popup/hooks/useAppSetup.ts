import { useEffect, useState } from 'react';
import { labelExists, getGmailProfile } from '@gmail/gmail-client';
import { getAuthToken, removeAuthToken } from '@gmail/gmail-auth';
import { getConfig, saveConfig } from '@storage/config-store';
import { recheckSites } from '@utils/SettingsPanel/siteSignIn';
import { checkApiReady } from '@utils/SettingsPanel/APICall';
import { WORKER_URL, AUTH_REQUIRED_DOMAINS } from '../../config';

type SetupState =
  | { status: 'checking' }
  | { status: 'needs_setup'; missingLabels: string[] }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export function useAppSetup(isStandalone: boolean) {
  const [setup,        setSetup]        = useState<SetupState>({ status: isStandalone ? 'ready' : 'checking' });
  const [gmailEmail,   setGmailEmail]   = useState('');
  const [maxResumes,   setMaxResumes]   = useState(2);
  const [apiStatus,    setApiStatus]    = useState<'checking' | 'ok' | 'error'>('checking');
  const [siteStatus,   setSiteStatus]   = useState<Record<string, boolean | null>>({});
  const [siteChecking, setSiteChecking] = useState(false);

  useEffect(() => {
    getConfig().then(async (cfg) => {
      setMaxResumes(cfg.maxResumes);
      const ok = await checkApiReady(cfg);
      setApiStatus(ok ? 'ok' : 'error');
    });
    recheckSites(setSiteChecking, setSiteStatus);
    getGmailProfile().then((email) => { if (email) setGmailEmail(email); }).catch(() => {});
    if (!isStandalone) _checkLabels();
  }, []);

  // Auto-submit email once labels are confirmed ready
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
      }).catch(() => {});
      saveConfig({ emailSignupShown: true, emailSignupAddress: email });
    });
  }, [setup.status]);

  async function checkLabels() {
    setSetup({ status: 'checking' });
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timed out — check OAuth client ID and Gmail API is enabled')), 60_000)
      );
      const hasJobposts = await Promise.race([labelExists('jobposts'), timeout]) as boolean;
      const missing: string[] = [];
      if (!hasJobposts) missing.push('jobposts');
      setSetup(missing.length > 0 ? { status: 'needs_setup', missingLabels: missing } : { status: 'ready' });
    } catch (err) {
      setSetup({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  // Expose mode so App can pass isPro to ResultsTab
  const [mode, setMode] = useState<string>('groq');
  useEffect(() => { getConfig().then((cfg) => setMode(cfg.mode)); }, []);

  async function handleSignOut() {
    try {
      const token = await getAuthToken(false);
      await removeAuthToken(token);
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
    } catch { /* no active token */ }
    await saveConfig({ emailSignupShown: false, emailSignupAddress: undefined });
    window.close();
  }

  function _checkLabels() { checkLabels(); }

  const siteVals  = Object.keys(AUTH_REQUIRED_DOMAINS).map(h => siteStatus[h]);
  const sitesOk   = siteVals.length > 0 && siteVals.every(v => v === true);
  const sitesWarn = siteVals.some(v => v === false);

  async function recheckApi() {
    setApiStatus('checking');
    const cfg = await getConfig();
    const ok  = await checkApiReady(cfg);
    setApiStatus(ok ? 'ok' : 'error');
  }

  return {
    setup, checkLabels, handleSignOut,
    gmailEmail, maxResumes, mode,
    apiStatus, sitesOk, sitesWarn, siteChecking,
    recheckApi,
  };
}
