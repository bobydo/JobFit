import React from 'react';
import { shared } from './shared.styles';
import type { LoginWallResult } from '../types';

type Props = {
  // Status strip
  sitesOk: boolean;
  sitesWarn: boolean;
  siteChecking: boolean;
  apiOk: boolean;
  apiWarn: boolean;
  apiChecking: boolean;
  // Right side
  loginWalls: LoginWallResult[];
  gmailEmail: string;
  showSettings: boolean;
  onSignOut: () => void;
  onToggleSettings: () => void;
  onOpenSettings: () => void;
};

export default function Header({
  sitesOk, sitesWarn, siteChecking,
  apiOk, apiWarn, apiChecking,
  loginWalls, gmailEmail,
  onSignOut, onToggleSettings, onOpenSettings,
}: Props) {
  function chip(label: string, ok: boolean, warn: boolean, checking: boolean) {
    return (
      <span
        onClick={warn ? onOpenSettings : undefined}
        style={{
          fontSize: 11, fontWeight: 700, userSelect: 'none',
          color: checking ? '#aaa' : ok ? '#2e7d32' : warn ? '#e65100' : '#aaa',
          cursor: warn ? 'pointer' : 'default',
        }}
      >
        {checking ? `… ${label}` : ok ? `✓ ${label}` : `⚠ ${label}`}
      </span>
    );
  }

  return (
    <div style={s.header}>
      {/* Left: logo + status strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={s.logo}>JobFit</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {chip('Job sites', sitesOk, sitesWarn, siteChecking)}
          {chip('API', apiOk, apiWarn, apiChecking)}
        </div>
      </div>

      {/* Right: email badge + settings */}
      {gmailEmail && (
        <div style={s.loginBadge}>
          <span style={s.loginDot} />
          <span style={s.loginEmail}>{gmailEmail.replace(/@.*/, '')}</span>
          <button style={s.signOutBtn} onClick={onSignOut}>Sign out</button>
        </div>
      )}
      <button
        style={{ ...s.iconBtn, ...(loginWalls.length > 0 ? s.iconBtnWarn : {}) }}
        onClick={onToggleSettings}
      >
        ⚙ Settings{loginWalls.length > 0 && <span style={s.warnDot}>!</span>}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header:      shared.panelHeader,
  logo:        { fontWeight: 700, fontSize: 16 },
  iconBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 6px', borderRadius: 4 },
  iconBtnWarn: { color: '#e65100' },
  warnDot:     { marginLeft: 3, fontWeight: 700, color: '#e65100' },
  loginBadge:  { display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', marginRight: 6 },
  loginDot:    { width: 7, height: 7, borderRadius: '50%', background: '#34a853', flexShrink: 0 },
  loginEmail:  { fontSize: 11, color: '#555', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  signOutBtn:  { ...shared.dangerBtn, padding: '4px 10px' },
};
