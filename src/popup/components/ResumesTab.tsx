import { useEffect, useState } from 'react';
import { getAuthToken, ensureDriveScopeConsent } from '@gmail/gmail-auth';
import { DrivePickerBridge } from '@drive/picker-bridge';
import { downloadFile } from '@drive/drive-client';
import { extractText } from '@utils/pdf-parser';
import { getUploadedResumes, addResume, deleteResume } from '@storage/resume-store';
import type { Resume } from '../types';
import { resumesStyles as s, shared } from './shared.styles';

interface Props {
  activeResumeIds: string[];
  onToggle: (id: string) => void;
  cachedData: Resume[] | null;
  onDataLoaded: (data: Resume[]) => void;
  onResumeDeleted: (id: string) => void;
  maxResumes: number;
}

export default function ResumesTab({ activeResumeIds, onToggle, cachedData, onDataLoaded, onResumeDeleted, maxResumes }: Props) {
  const [resumes, setResumes] = useState<Resume[]>(cachedData ?? []);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(cachedData ? 'loaded' : 'loading');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (cachedData) return;
    load();
  }, []);

  async function load() {
    setStatus('loading');
    try {
      const stored = await getUploadedResumes();
      apply(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  function apply(data: Resume[]) {
    setResumes(data);
    onDataLoaded(data);
    setStatus('loaded');
  }

  async function handleAddFromDrive() {
    setUploading(true);
    setError('');
    try {
      await ensureDriveScopeConsent();
      const token = await getAuthToken(true);
      const bridge = new DrivePickerBridge();
      const picked = await bridge.pick(token);
      if (!picked) return; // user cancelled
      const buffer = await downloadFile(picked.fileId, token);
      const text = await extractText(buffer);
      if (!text.trim()) {
        throw new Error('Could not extract text from that PDF (it may be scanned or image-only).');
      }
      const next = await addResume({
        id: picked.fileId,
        subject: picked.fileName,
        body: text,
      });
      apply(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    const next = await deleteResume(id);
    apply(next);
    onResumeDeleted(id);
    if (expandedId === id) setExpandedId(null);
  }

  const addButton = (
    <button
      style={{ ...shared.primaryBtn, padding: '6px 12px', fontSize: 12 }}
      onClick={handleAddFromDrive}
      disabled={uploading}
    >
      {uploading ? 'Processing…' : '+ Add Resume from Drive'}
    </button>
  );

  if (status === 'loading') return <div style={s.center}>Loading resumes…</div>;

  if (resumes.length === 0) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{addButton}</div>
        {error && <div style={{ color: '#c00', fontSize: 12, marginBottom: 8 }}>{error}</div>}
        <div style={s.empty}>
          <p>No resumes yet.</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            Click <strong>Add Resume from Drive</strong> to pick a PDF resume from your Google Drive.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={s.hint}>
          Select up to {maxResumes} for analysis ({activeResumeIds.length}/{maxResumes} selected)
        </div>
        {addButton}
      </div>
      {error && <div style={{ color: '#c00', fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {resumes.map((r) => {
        const checked = activeResumeIds.includes(r.id);
        const isExpanded = r.id === expandedId;
        return (
          <div key={r.id} style={{ ...s.card, ...(checked ? s.cardChecked : {}) }}>
            <div style={s.cardHeader}>
              <label style={s.label}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(r.id)}
                  style={s.checkbox}
                />
                <span style={{ ...s.subject, ...(checked ? s.subjectChecked : {}) }}>
                  {r.subject}
                </span>
              </label>
              <button
                style={s.expandBtn}
                onClick={() => setExpandedId(isExpanded ? null : r.id)}
                title={isExpanded ? 'Collapse' : 'Expand body'}
              >
                {isExpanded ? '▲' : '▼'}
              </button>
              <button
                style={{ ...shared.dangerBtn, padding: '3px 8px', marginLeft: 4 }}
                onClick={() => handleDelete(r.id)}
                title="Delete resume"
              >
                Delete
              </button>
            </div>
            {isExpanded && (
              <pre style={s.cardBody}>{r.body || '(empty body)'}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
