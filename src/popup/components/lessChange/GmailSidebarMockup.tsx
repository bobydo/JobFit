import type React from 'react';

const s: Record<string, React.CSSProperties> = {
  mockup:             { flexShrink: 0, width: 130, background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 7, padding: '8px 10px', fontSize: 11 },
  mockupTitle:        { fontWeight: 700, fontSize: 12, color: '#444', marginBottom: 4 },
  mockupDivider:      { height: 1, background: '#e0e0e0', margin: '4px 0' },
  mockupRow:          { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', color: '#555' },
  mockupSectionLabel: { fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '2px 0 3px' },
  mockupHighlight:    { background: '#e8f0fe', borderRadius: 4, padding: '2px 5px', margin: '1px 0', color: '#1a73e8' },
  mockupLabelName:    { flex: 1, fontWeight: 600 },
  mockupArrow:        { fontSize: 10, color: '#1a73e8', fontStyle: 'italic' },
};

export default function GmailSidebarMockup({ highlight }: { highlight: ('resumes' | 'jobposts')[] }) {
  return (
    <div style={s.mockup}>
      <div style={s.mockupTitle}>Gmail</div>
      <div style={s.mockupDivider} />
      <div style={s.mockupRow}><span>📥</span><span>Inbox</span></div>
      <div style={s.mockupRow}><span>📤</span><span>Sent</span></div>
      <div style={s.mockupDivider} />
      <div style={s.mockupSectionLabel}>Labels</div>
      {(['resumes', 'jobposts'] as const).filter((l) => highlight.includes(l)).map((label) => (
        <div key={label} style={{ ...s.mockupRow, ...s.mockupHighlight }}>
          <span>🏷</span>
          <span style={s.mockupLabelName}>{label}</span>
          <span style={s.mockupArrow}>← create this</span>
        </div>
      ))}
    </div>
  );
}
