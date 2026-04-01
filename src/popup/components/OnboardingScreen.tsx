interface Props {
  missingLabels: string[];
  onContinue: () => void;
}

export default function OnboardingScreen({ missingLabels, onContinue }: Props) {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Welcome to JobFit!</h2>
      <p style={styles.intro}>To get started, create these Gmail labels:</p>

      <div style={styles.labels}>
        {missingLabels.includes('resumes') && (
          <div style={styles.labelBlock}>
            <code style={styles.code}>resumes</code>
            <p style={styles.desc}>
              Send yourself an email with your resume pasted in the body, then apply this label.
            </p>
          </div>
        )}
        {missingLabels.includes('jobposts') && (
          <div style={styles.labelBlock}>
            <code style={styles.code}>jobposts</code>
            <p style={styles.desc}>
              Set up a Gmail filter to auto-label your subscribed job alert emails here.
            </p>
          </div>
        )}
      </div>

      <div style={styles.actions}>
        <a
          href="https://mail.google.com/mail/#settings/labels"
          target="_blank"
          rel="noreferrer"
          style={styles.link}
        >
          Open Gmail Label Settings →
        </a>
        <button style={styles.btn} onClick={onContinue}>
          I've done this — continue
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  title: { fontSize: 18, fontWeight: 700 },
  intro: { color: '#444' },
  labels: { display: 'flex', flexDirection: 'column', gap: 12 },
  labelBlock: { background: '#f5f5f5', borderRadius: 6, padding: 12 },
  code: { display: 'inline-block', background: '#e8f0fe', color: '#1a73e8', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', marginBottom: 4 },
  desc: { fontSize: 13, color: '#555', marginTop: 4 },
  actions: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  link: { fontSize: 13, color: '#1a73e8', textDecoration: 'none' },
  btn: { padding: '8px 14px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
};
