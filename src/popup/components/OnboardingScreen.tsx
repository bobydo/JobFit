import { onboardingStyles as s } from './shared.styles';
import GmailSidebarMockup from './lessChange/GmailSidebarMockup';

interface Props {
  missingLabels: string[];
  onContinue: () => void;
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

