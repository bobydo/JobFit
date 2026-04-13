import type { LoginWallResult } from '../types';

export default function SignInPrompt({ jobUrl, domain }: LoginWallResult) {
  const short = jobUrl.length > 50 ? jobUrl.slice(0, 50) + '\u2026' : jobUrl;
  return (
    <div style={{
      border: '1px solid #f5c518',
      borderRadius: 8,
      background: '#fffde7',
      padding: '10px 14px',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
          Sign in to {domain} to analyze this job
        </div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{short}</div>
      </div>
      <a
        href={jobUrl}
        style={{ fontSize: 12, color: '#1a73e8', whiteSpace: 'nowrap', textDecoration: 'none' }}
        onClick={(e) => { e.preventDefault(); chrome.windows.create({ url: jobUrl, type: 'normal' }); }}
      >
        Open →
      </a>
    </div>
  );
}
