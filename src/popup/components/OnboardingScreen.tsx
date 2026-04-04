interface Props {
  missingLabels: string[];
  onContinue: () => void;
}

function GmailSidebarMockup({ highlight }: { highlight: ('resumes' | 'jobposts')[] }) {
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

export default function OnboardingScreen({ missingLabels, onContinue }: Props) {
  const missing = missingLabels as ('resumes' | 'jobposts')[];
  const bothMissing = missing.includes('resumes') && missing.includes('jobposts');

  return (
    <div style={s.container}>
      <h2 style={s.title}>Welcome to JobFit!</h2>

      {/* Privacy reassurance */}
      <div style={s.privacyBox}>
        <span style={s.privacyIcon}>🔒</span>
        <div>
          <div style={s.privacyHeading}>Your emails stay private</div>
          <div style={s.privacyText}>
            JobFit only reads emails in the <strong>resumes</strong> and <strong>jobposts</strong> labels.
          </div>
        </div>
      </div>

      {/* Gmail sidebar + instructions side by side */}
      <div style={s.mainRow}>
        <GmailSidebarMockup highlight={missing} />

        <div style={s.labelBlocks}>
          {missing.includes('resumes') && (
            <div style={{ ...s.labelBlock, ...(bothMissing ? s.labelBlockHalf : {}) }}>
              <div style={s.labelHeader}>
                <code style={s.code}>resumes</code>
              </div>
              <ol style={s.steps}>
                <li>Create label <code style={s.inlineCode}>resumes</code></li>
                <li>Email yourself — subject = role title (e.g. <em>Frontend Developer</em>), body = resume text</li>
                <li>Apply the label to that email</li>
              </ol>
            </div>
          )}
          {missing.includes('jobposts') && (
            <div style={{ ...s.labelBlock, ...(bothMissing ? s.labelBlockHalf : {}) }}>
              <div style={s.labelHeader}>
                <code style={s.code}>jobposts</code>
              </div>
              <ol style={s.steps}>
                <li>Create label <code style={s.inlineCode}>jobposts</code></li>
                <li>Filter job alerts from LinkedIn / Indeed → apply label</li>
                <li>Or drag job emails onto the label manually</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      <div style={s.actions}>
        <a
          href="https://mail.google.com/mail/#settings/labels"
          target="_blank"
          rel="noreferrer"
          style={s.link}
          onClick={(e) => { e.preventDefault(); chrome.tabs.create({ url: 'https://mail.google.com/mail/#settings/labels' }); }}
        >
          Open Gmail Label Settings →
        </a>
        <button style={s.btn} onClick={onContinue}>
          I've done this — continue
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container:        { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  title:            { fontSize: 17, fontWeight: 700, margin: 0 },
  privacyBox:       { display: 'flex', gap: 8, background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 7, padding: '8px 10px', alignItems: 'flex-start' },
  privacyIcon:      { fontSize: 15, flexShrink: 0, marginTop: 1 },
  privacyHeading:   { fontWeight: 600, fontSize: 12, color: '#2e7d32', marginBottom: 1 },
  privacyText:      { fontSize: 11, color: '#388e3c', lineHeight: 1.4 },
  mainRow:          { display: 'flex', gap: 10, alignItems: 'flex-start' },
  mockup:           { flexShrink: 0, width: 130, background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 7, padding: '8px 10px', fontSize: 11 },
  mockupTitle:      { fontWeight: 700, fontSize: 12, color: '#444', marginBottom: 4 },
  mockupDivider:    { height: 1, background: '#e0e0e0', margin: '4px 0' },
  mockupRow:        { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', color: '#555' },
  mockupSectionLabel: { fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, margin: '2px 0 3px' },
  mockupHighlight:  { background: '#e8f0fe', borderRadius: 4, padding: '2px 5px', margin: '1px 0', color: '#1a73e8' },
  mockupLabelName:  { flex: 1, fontWeight: 600 },
  mockupArrow:      { fontSize: 10, color: '#1a73e8', fontStyle: 'italic' as const },
  labelBlocks:      { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  labelBlock:       { background: '#f5f5f5', borderRadius: 6, padding: '8px 10px' },
  labelBlockHalf:   {},
  labelHeader:      { marginBottom: 6 },
  code:             { background: '#e8f0fe', color: '#1a73e8', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 },
  inlineCode:       { background: '#e8f0fe', color: '#1a73e8', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 10 },
  steps:            { margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#444', lineHeight: 1.4 },
  actions:          { display: 'flex', flexDirection: 'column', gap: 7 },
  link:             { fontSize: 12, color: '#1a73e8', textDecoration: 'none' },
  btn:              { padding: '8px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
};
