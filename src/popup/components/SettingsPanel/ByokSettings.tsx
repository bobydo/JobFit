import React from "react";

export type ByokProvider = "groq" | "anthropic" | "openai";
export type KeyStatus = "idle" | "validating" | "ok" | "error";

type Props = {
    mode: string;
    byokProvider: ByokProvider;
    apiKey: string;
    keyStatus: KeyStatus;
    showKey: boolean;

    onModeChange: (provider: ByokProvider) => void;
    onProviderChange: (provider: ByokProvider) => void;
    onApiKeyChange: (value: string) => void;
    onToggleShowKey: () => void;
    onSave: () => void;

    hints: Record<ByokProvider, string>;
    styles: any; // reuse your existing `s`
    };

    const PROVIDERS: ByokProvider[] = ["groq", "anthropic", "openai"];

export default function ByokSettings({
    mode,
    byokProvider,
    apiKey,
    keyStatus,
    showKey,
    onModeChange,
    onProviderChange,
    onApiKeyChange,
    onToggleShowKey,
    onSave,
    hints,
    styles: s,
    }: Props) {
    const isByok = PROVIDERS.includes(mode as ByokProvider);

    return (
    <>
        {/* Radio */}
        <label style={s.radioRow}>
        <input
            type="radio"
            checked={isByok}
            onChange={() => onModeChange(byokProvider)}
        />
        <span style={s.radioLabel}>My own API key</span>
        </label>

        {isByok && (
        <div style={s.indent}>
            {/* Provider */}
            <div style={s.fieldLabel}>Provider</div>
            <select
            style={s.select}
            value={byokProvider}
            onChange={(e) =>
                onProviderChange(e.target.value as ByokProvider)
            }
            >
            <option value="groq">Groq</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            </select>

            {/* API Key */}
            <div style={s.fieldLabel}>API Key</div>
            <div style={s.row}>
            <input
                style={s.input}
                type={showKey ? "text" : "password"}
                placeholder="Paste API key…"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
            />

            <button style={s.eyeBtn} onClick={onToggleShowKey}>
                {showKey ? "🙈" : "👁"}
            </button>

            <button
                style={s.saveBtn}
                onClick={onSave}
                disabled={keyStatus === "validating"}
            >
                {keyStatus === "validating" ? "Validating..." : "Test & Save"}
            </button>
            </div>

            {/* Hint */}
            <div style={s.hint}>{hints[byokProvider]}</div>

            {/* Status */}
            {keyStatus === "ok" && (
            <div style={s.ok}>Succeeded</div>
            )}
            {keyStatus === "error" && (
            <div style={s.err}>
                Could not connect — check your key and try again
            </div>
            )}

            {/* Waiver */}
            <div style={s.waiverBox}>
            ⚠ Your API key is stored locally on this device and used only to
            contact your chosen provider. JobFit never transmits your key to any
            external server. You are responsible for any usage charges incurred.
            </div>
        </div>
        )}
    </>
    );
}