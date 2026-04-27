import { useEffect, useState } from 'react';
import { getConfig, saveConfig, AppConfig, LLMMode, ByokProvider } from '@storage/config-store';
import { WORKER_URL, STRIPE_PRO_URL, OLLAMA_MODEL, OLLAMA_BASE_URL, LANGFUSE_BASE_URL, DEV_MODE, AUTH_REQUIRED_DOMAINS, OPENAI_DEFAULT_MODEL, DAILY_ANALYSIS_LIMIT } from '../../../config';
import { recheckSites as _recheckSites } from '@utils/SettingsPanel/siteSignIn';
import { validateApiKey } from '@utils/SettingsPanel/APICall';
import { settingsPanelStyles as s } from '../shared.styles';
import ByokSettings from './ByokSettings';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [mode, setMode] = useState<LLMMode>('jobfit-cloud');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle');
  const [activePlan, setActivePlan] = useState<string | undefined>(undefined);
  const [subscribeClicked, setSubscribeClicked] = useState(false);
  const [byokProvider, setByokProvider] = useState<ByokProvider>('groq');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle');
  const [showByokWarning, setShowByokWarning] = useState(false);
  const [ollamaModel, setOllamaModel] = useState(OLLAMA_MODEL);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(OLLAMA_BASE_URL);
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle');
  const [langfuseEnabled, setLangfuseEnabled] = useState(false);
  const [langfuseHost, setLangfuseHost] = useState(LANGFUSE_BASE_URL);
  const [langfusePublicKey, setLangfusePublicKey] = useState('');
  const [langfuseSecretKey, setLangfuseSecretKey] = useState('');
  const [langfuseStatus, setLangfuseStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [siteStatus, setSiteStatus] = useState<Record<string, boolean | null>>({});
  const [siteChecking, setSiteChecking] = useState(false);

  useEffect(() => {
    getConfig().then((cfg) => {
      setConfig(cfg);
      setMode(cfg.mode);
      setTokenInput(cfg.subscriptionToken ?? '');
      if (cfg.subscriptionPlan) setActivePlan(cfg.subscriptionPlan);
      setByokProvider(cfg.byokProvider ?? 'groq');
      setApiKey(cfg.apiKey ?? '');
      setOllamaModel(cfg.ollamaModel ?? 'qwen3:8b');
      setOllamaBaseUrl(cfg.ollamaBaseUrl ?? 'http://localhost:11434');
      setLangfuseEnabled(cfg.langfuseEnabled ?? false);
      setLangfuseHost(cfg.langfuseHost ?? '');
      setLangfusePublicKey(cfg.langfusePublicKey ?? '');
      setLangfuseSecretKey(cfg.langfuseSecretKey ?? '');
      if (cfg.subscriptionToken) {
        // Re-validate against server — token may have been revoked (e.g. subscription cancelled)
        setTokenStatus('validating');
        fetch(`${WORKER_URL}/validate-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: cfg.subscriptionToken }),
        }).then((res) => {
          setTokenStatus(res.ok ? 'ok' : 'error');
          if (!res.ok) saveConfig({ subscriptionToken: undefined, subscriptionPlan: undefined });
        }).catch(() => setTokenStatus('ok')); // keep ok on network error — don't penalise offline users
      }
      if (cfg.apiKey) setKeyStatus('ok');
      if (cfg.mode === 'ollama') setOllamaStatus('ok');
    });
  }, []);


  async function recheckSites() {
    await _recheckSites(setSiteChecking, setSiteStatus);
  }

  useEffect(() => { recheckSites(); }, []);

  function openStripe(url: string) {
    chrome.tabs.create({ url });
  }

  async function saveToken() {
    const token = tokenInput.trim();
    if (!token) return;
    setTokenStatus('validating');
    try {
      const res = await fetch(`${WORKER_URL}/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error('invalid');
      const { plan } = await res.json() as { plan: 'pro' };
      await saveConfig({ mode: 'jobfit-cloud', subscriptionToken: token, subscriptionPlan: plan });
      setMode('jobfit-cloud');
      setActivePlan(plan);
      setTokenStatus('ok');
    } catch {
      setTokenStatus('error');
    }
  }

  async function saveApiKey() {
    if (!config?.byokAcknowledged) {
      setShowByokWarning(true);
      return;
    }
    await doSaveApiKey();
  }

  async function doSaveApiKey() {
    const key = apiKey.trim();
    if (!key) return;
    setKeyStatus('validating');
    try {
      const ok = await validateApiKey(byokProvider, key);
      if (!ok) throw new Error('invalid key');
      await saveConfig({ mode: byokProvider, byokProvider, apiKey: key });
      setMode(byokProvider);
      setKeyStatus('ok');
    } catch {
      setKeyStatus('error');
    }
  }

  async function acknowledgeAndSave() {
    await saveConfig({ byokAcknowledged: true });
    setShowByokWarning(false);
    await doSaveApiKey();
  }

  async function saveOllama() {
    const url = ollamaBaseUrl.trim() || 'http://localhost:11434';
    const model = ollamaModel.trim() || 'qwen3:8b';
    setOllamaStatus('validating');
    try {
      const res = await fetch(`${url}/api/tags`);
      if (!res.ok) throw new Error();
      await saveConfig({ mode: 'ollama', ollamaModel: model, ollamaBaseUrl: url });
      setMode('ollama');
      setOllamaStatus('ok');
    } catch {
      setOllamaStatus('error');
    }
  }

  async function saveLangfuse() {
    const host = langfuseHost.trim();
    if (!host) { setLangfuseStatus('error'); return; }
    await saveConfig({
      langfuseEnabled,
      langfuseHost: host,
      langfusePublicKey: langfusePublicKey.trim(),
      langfuseSecretKey: langfuseSecretKey.trim(),
    });
    setLangfuseStatus('ok');
  }

  async function handleLangfuseToggle(enabled: boolean) {
    setLangfuseEnabled(enabled);
    await saveConfig({ langfuseEnabled: enabled });
  }

  if (!config) return <div style={s.loading}>Loading…</div>;

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.panelHeader}>
        <span style={s.title}>Settings</span>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={s.body}>

        {/* ── LLM Mode + Job Site Sign-in (side by side) ── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.sectionLabel}>LLM Mode</div>

          {/* JobFit Pro */}
          <label style={s.radioRow}>
            <input type="radio" checked={mode === 'jobfit-cloud'} onChange={() => setMode('jobfit-cloud')} />
            <span style={s.radioLabel}>JobFit Pro</span>
          </label>

          {mode === 'jobfit-cloud' && (
            <div style={s.indent}>
              {/* Plan card */}
              <div style={{ ...s.planCard, ...s.planCardPro, marginBottom: 10 }}>
                <div style={s.planName}>JobFit Pro</div>
                <div style={s.planPrice}>$11 CAD <span style={s.planPer}>/mo</span></div>
                <ul style={{ margin: '8px 0', paddingLeft: 16, fontSize: 11, lineHeight: 1.7 }}>
                  <li>No API key required</li>
                  <li>Powered by {OPENAI_DEFAULT_MODEL}</li>
                  <li>{DAILY_ANALYSIS_LIMIT} analyses/day</li>
                  <li>Role-weighted scoring (skills · experience · tools · domain)</li>
                  <li>Clean summary results</li>
                  <li>High-match tracking — jobs ≥85% saved for tips</li>
                  <li>Fixed cost — no per-token surprises</li>
                </ul>
                <button
                  style={{ ...s.subscribeBtn, ...s.subscribeBtnPro, ...(tokenStatus === 'ok' ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                  disabled={tokenStatus === 'ok'}
                  onClick={() => { openStripe(STRIPE_PRO_URL); setSubscribeClicked(true); }}
                >
                  {tokenStatus === 'ok' ? 'Subscribed ✓' : 'Subscribe →'}
                </button>
                {subscribeClicked && tokenStatus !== 'ok' && (
                  <div style={{ fontSize: 11, color: '#1a73e8', marginTop: 6 }}>
                    ✉ Check your email for the subscription token, then paste it below.
                  </div>
                )}
              </div>

              {/* Token entry */}
              <div style={s.fieldLabel}>Subscription token</div>
              <div style={s.hint}>After subscribing, check your confirmation email for your token.</div>
              <div style={s.row}>
                <input
                  style={s.input}
                  type="text"
                  placeholder="Paste token here…"
                  value={tokenInput}
                  onChange={(e) => { setTokenInput(e.target.value); setTokenStatus('idle'); }}
                />
                <button style={s.saveBtn} onClick={saveToken} disabled={tokenStatus === 'validating'}>
                  {tokenStatus === 'validating' ? '…' : 'Save'}
                </button>
              </div>
              {tokenStatus === 'ok'    && <div style={s.ok}>Token saved — {activePlan ?? config.subscriptionPlan ?? 'active'} active</div>}
              {tokenStatus === 'error' && <div style={s.err}>Invalid token — check your email or re-subscribe</div>}

              {tokenStatus === 'ok' && (
                <div style={{ marginTop: 10 }}>
                  <button
                    style={{ ...s.saveBtn, background: 'none', color: '#1a73e8', border: '1px solid #1a73e8', width: '100%' }}
                    onClick={async () => {
                      const token = config.subscriptionToken ?? tokenInput.trim();
                      const returnUrl = chrome.runtime.getURL('src/popup/popup.html');
                      try {
                        const res = await fetch(`${WORKER_URL}/create-portal-session`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ token, returnUrl }),
                        });
                        if (res.ok) {
                          const { url } = await res.json() as { url: string };
                          chrome.tabs.create({ url });
                        } else {
                          const { error } = await res.json() as { error: string };
                          alert(`Could not open portal: ${error}`);
                        }
                      } catch (e) {
                        alert(`Network error: ${e instanceof Error ? e.message : String(e)}`);
                      }
                    }}
                  >
                    Manage subscription →
                  </button>
                  <div style={{ fontSize: 10, color: '#999', marginTop: 6, lineHeight: 1.5 }}>
                    Cancel anytime — no charge next month, no refund for current period.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* My own API key */}
          <ByokSettings
            mode={mode}
            byokProvider={byokProvider}
            apiKey={apiKey}
            keyStatus={keyStatus}
            showKey={showKey}
            onModeChange={setMode}
            onProviderChange={setByokProvider}
            onApiKeyChange={setApiKey}
            onToggleShowKey={() => setShowKey(!showKey)}
            onSave={saveApiKey}
            hints={{
              groq:      'Get a free key at console.groq.com → API Keys. Free tier covers ~14,400 req/day.',
              anthropic: 'Get a key at console.anthropic.com → API Keys.',
              openai:    'Get a key at platform.openai.com → API keys.',
            }}
            styles={s}
          />

          {/* Ollama — local dev, no subscription */}
          {DEV_MODE && (
            <>
              <label style={s.radioRow}>
                <input type="radio" checked={mode === 'ollama'} onChange={() => setMode('ollama')} />
                <span style={s.radioLabel}>Ollama <span style={s.devBadge}>dev</span></span>
              </label>

              {mode === 'ollama' && (
                <div style={s.indent}>
                  <div style={s.hint}>Runs locally — no subscription or API key required.</div>

                  <div style={s.fieldLabel}>Base URL</div>
                  <input
                    style={s.input}
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => { setOllamaBaseUrl(e.target.value); setOllamaStatus('idle'); }}
                    placeholder="http://localhost:11434"
                  />

                  <div style={s.fieldLabel}>Model</div>
                  <div style={s.row}>
                    <input
                      style={s.input}
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => { setOllamaModel(e.target.value); setOllamaStatus('idle'); }}
                      placeholder="qwen3:8b"
                    />
                    <button style={s.saveBtn} onClick={saveOllama} disabled={ollamaStatus === 'validating'}>
                      {ollamaStatus === 'validating' ? '…' : 'Test'}
                    </button>
                  </div>
                  {ollamaStatus === 'ok'    && <div style={s.ok}>Connected — model saved</div>}
                  {ollamaStatus === 'error' && <div style={s.err}>Could not reach Ollama — is it running?</div>}
                </div>
              )}
            </>
          )}

          {/* ── Observability (Langfuse) — dev only ── */}
        {DEV_MODE && (
          <div style={s.section}>
            <div style={s.sectionLabel}>Observability (Langfuse)</div>

            <label style={{ ...s.radioRow, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={langfuseEnabled}
                onChange={(e) => handleLangfuseToggle(e.target.checked)}
              />
              <span style={s.radioLabel}>Enable Langfuse tracing</span>
            </label>
            <div style={s.hint}>
              Traces every LLM call — prompt, response, tokens, latency — to your self-hosted Langfuse instance.
            </div>

            <div style={s.fieldLabel}>Host URL</div>
            <input
              style={s.input}
              type="text"
              value={langfuseHost}
              onChange={(e) => { setLangfuseHost(e.target.value); setLangfuseStatus('idle'); }}
              placeholder="http://localhost:3001"
            />

            <div style={s.fieldLabel}>Public Key</div>
            <input
              style={s.input}
              type="text"
              value={langfusePublicKey}
              onChange={(e) => { setLangfusePublicKey(e.target.value); setLangfuseStatus('idle'); }}
              placeholder="pk-lf-..."
            />

            <div style={s.fieldLabel}>Secret Key</div>
            <div style={s.row}>
              <input
                style={s.input}
                type="password"
                value={langfuseSecretKey}
                onChange={(e) => { setLangfuseSecretKey(e.target.value); setLangfuseStatus('idle'); }}
                placeholder="sk-lf-..."
              />
              <button style={s.saveBtn} onClick={saveLangfuse}>
                Save
              </button>
            </div>
            {langfuseStatus === 'ok'    && <div style={s.ok}>Settings saved</div>}
            {langfuseStatus === 'error' && <div style={s.err}>Host URL is required</div>}
          </div>
        )}
        </div>{/* end left column */}

        {/* ── Job Site Sign-in — right column ── */}
        <div style={{ width: 155, flexShrink: 0 }}>
          <div style={{ ...s.sectionLabel, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            Job Site Sign-in
            <button
              style={{ ...s.saveBtn, fontSize: 10, padding: '1px 6px' }}
              onClick={recheckSites}
              disabled={siteChecking}
            >
              {siteChecking ? 'Checking…' : 'Recheck'}
            </button>
          </div>
          <div style={s.hint}>Must be signed in so JobFit can read job details.</div>
          {Object.entries(AUTH_REQUIRED_DOMAINS).map(([hostname, cfg]) => {
            const status = siteStatus[hostname];
            const checking = siteChecking || status === undefined;
            return (
              <div key={hostname} style={{ marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{cfg.displayName}: </span>
                {checking ? (
                  <span style={{ color: '#aaa' }}>Checking…</span>
                ) : status ? (
                  <span style={{ color: '#2e7d32' }}>✓ Signed in</span>
                ) : (
                  <button
                    style={{ fontSize: 11, padding: '1px 6px', background: 'none', border: '1px solid #1a73e8', borderRadius: 4, color: '#1a73e8', cursor: 'pointer' }}
                    onClick={() => chrome.tabs.create({ url: cfg.signInUrl })}
                  >
                    Sign in →
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </div>{/* end flex row */}

      </div>

      {/* BYOK waiver modal */}
      {showByokWarning && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <div style={s.modalTitle}>Before saving your API key</div>
            <p style={s.modalText}>
              Your API key is stored locally on this device and used only to contact your chosen provider.
              JobFit never transmits your key to any external server. You are responsible for keeping your
              key secure and for any usage charges incurred. If you suspect your key has been compromised,
              revoke it immediately from your provider's dashboard.
            </p>
            <div style={s.modalBtns}>
              <button style={s.modalCancel} onClick={() => setShowByokWarning(false)}>Cancel</button>
              <button style={s.modalOk} onClick={acknowledgeAndSave}>I understand — save key</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

