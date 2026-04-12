import { useEffect, useState } from 'react';
import { getConfig, saveConfig, AppConfig, LLMMode, ByokProvider } from '@storage/config-store';
import { WORKER_URL, STRIPE_PRO_URL, OLLAMA_MODEL, OLLAMA_BASE_URL, LANGFUSE_BASE_URL, DEV_MODE } from '../../config';
import { settingsPanelStyles as s } from './shared.styles';

const BYOK_HINTS: Record<ByokProvider, string> = {
  groq:      'Get a free key at console.groq.com → API Keys. Free tier covers ~14,400 req/day.',
  anthropic: 'Get a key at console.anthropic.com → API Keys. Add credits first — no free tier.',
  openai:    'Get a key at platform.openai.com → API Keys. Add credits first — no free tier.',
};

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [mode, setMode] = useState<LLMMode>('jobfit-cloud');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle');
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
  const [saveFolder, setSaveFolder] = useState('jobfit');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig().then((cfg) => {
      setConfig(cfg);
      setMode(cfg.mode);
      setTokenInput(cfg.subscriptionToken ?? '');
      setByokProvider(cfg.byokProvider ?? 'groq');
      setApiKey(cfg.apiKey ?? '');
      setSaveFolder(cfg.saveFolder);
      setOllamaModel(cfg.ollamaModel ?? 'qwen3:8b');
      setOllamaBaseUrl(cfg.ollamaBaseUrl ?? 'http://localhost:11434');
      setLangfuseEnabled(cfg.langfuseEnabled ?? false);
      setLangfuseHost(cfg.langfuseHost ?? '');
      setLangfusePublicKey(cfg.langfusePublicKey ?? '');
      setLangfuseSecretKey(cfg.langfuseSecretKey ?? '');
      if (cfg.subscriptionToken) setTokenStatus('ok');
      if (cfg.apiKey) setKeyStatus('ok');
      if (cfg.mode === 'ollama') setOllamaStatus('ok');
    });
  }, []);


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
      // Lightweight validation per provider
      let ok = false;
      if (byokProvider === 'groq' || byokProvider === 'openai') {
        const url = byokProvider === 'groq'
          ? 'https://api.groq.com/openai/v1/models'
          : 'https://api.openai.com/v1/models';
        const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
        ok = res.ok;
      } else {
        // Anthropic: minimal 1-token completion
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        ok = res.ok;
      }
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

  async function handleSaveGeneral() {
    await saveConfig({
      saveFolder: saveFolder.trim() || 'jobfit',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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

        {/* ── LLM Mode ── */}
        <div style={s.section}>
          <div style={s.sectionLabel}>LLM Mode</div>

          {/* JobFit Cloud */}
          <label style={s.radioRow}>
            <input type="radio" checked={mode === 'jobfit-cloud'} onChange={() => setMode('jobfit-cloud')} />
            <span style={s.radioLabel}>JobFit Cloud</span>
          </label>

          {mode === 'jobfit-cloud' && (
            <div style={s.indent}>
              {/* Plan card */}
              <div style={{ ...s.planCard, ...s.planCardPro, marginBottom: 10 }}>
                <div style={s.planName}>Pro</div>
                <div style={s.planPrice}>$11 <span style={s.planPer}>/mo</span></div>
                <div style={s.planDetail}>2 resumes · 50 analyses/day · daily refresh</div>
                <button style={{ ...s.subscribeBtn, ...s.subscribeBtnPro }} onClick={() => openStripe(STRIPE_PRO_URL)}>
                  Subscribe →
                </button>
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
              {tokenStatus === 'ok'    && <div style={s.ok}>Token saved — {config.subscriptionPlan ?? 'active'}</div>}
              {tokenStatus === 'error' && <div style={s.err}>Invalid token — check your email or re-subscribe</div>}
            </div>
          )}

          {/* My own API key */}
          <label style={s.radioRow}>
            <input type="radio" checked={['groq','anthropic','openai'].includes(mode)} onChange={() => setMode(byokProvider)} />
            <span style={s.radioLabel}>My own API key</span>
          </label>

          {['groq','anthropic','openai'].includes(mode) && (
            <div style={s.indent}>
              <div style={s.fieldLabel}>Provider</div>
              <select style={s.select} value={byokProvider} onChange={(e) => { setByokProvider(e.target.value as ByokProvider); setMode(e.target.value as ByokProvider); setKeyStatus('idle'); }}>
                <option value="groq">Groq</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>

              <div style={s.fieldLabel}>API Key</div>
              <div style={s.row}>
                <input
                  style={s.input}
                  type={showKey ? 'text' : 'password'}
                  placeholder="Paste API key…"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyStatus('idle'); }}
                />
                <button style={s.eyeBtn} onClick={() => setShowKey(!showKey)}>{showKey ? '🙈' : '👁'}</button>
                <button style={s.saveBtn} onClick={saveApiKey} disabled={keyStatus === 'validating'}>
                  {keyStatus === 'validating' ? '…' : 'Save'}
                </button>
              </div>
              <div style={s.hint}>{BYOK_HINTS[byokProvider]}</div>
              {keyStatus === 'ok'    && <div style={s.ok}>Key saved and validated</div>}
              {keyStatus === 'error' && <div style={s.err}>Could not connect — check your key and try again</div>}

              <div style={s.waiverBox}>
                ⚠ Your API key is stored locally on this device and used only to contact your chosen provider.
                JobFit never transmits your key to any external server.
                You are responsible for any usage charges incurred.
              </div>
            </div>
          )}

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
        </div>

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

        {/* ── General ── */}
        <div style={s.section}>
          <div style={s.sectionLabel}>General</div>

          <div style={s.fieldLabel}>Log and Download folder</div>
          <div style={s.hint}>Results saved to Downloads/<span style={{ fontStyle: 'italic' }}>{saveFolder || 'jobfit'}</span>/</div>
          <input style={s.input} type="text" value={saveFolder} onChange={(e) => setSaveFolder(e.target.value)} />

          <div style={{ marginTop: 10 }}>
            <button style={s.saveBtn} onClick={handleSaveGeneral}>Save</button>
            {saved && <span style={{ ...s.ok, marginLeft: 8 }}>Saved</span>}
          </div>
        </div>

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

