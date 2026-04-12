import type React from 'react';

// ── Shared tokens (used across multiple components) ──────────────────────────

export const shared: Record<string, React.CSSProperties> = {
  // ── Buttons ─────────────────────────────────────────────────────────────
  /** Blue primary action button base — add padding + fontSize per component */
  primaryBtn:     { background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 },
  /** Destructive action button base (sign out, delete) — add padding per component */
  dangerBtn:      { fontSize: 11, background: '#fce8e6', border: '1px solid #e53935', borderRadius: 4, cursor: 'pointer', color: '#c62828', fontWeight: 600 },

  // ── Tab content states ───────────────────────────────────────────────────
  /** Centered loading / error text used in all 3 tabs */
  center:         { color: '#888', textAlign: 'center', paddingTop: 40 },
  /** Empty-state message used in Resumes + JobPosts tabs */
  empty:          { textAlign: 'center', paddingTop: 32, color: '#555', lineHeight: 1.6 },

  // ── Card pattern (Resumes, JobPosts, Results) ────────────────────────────
  card:           { border: '1px solid #e5e5e5', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  cardChecked:    { borderColor: '#1a73e8', background: '#f8fbff' },
  /** gap:8 is the standard — Results adds cursor:pointer on top */
  cardHeader:     { display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 8 },
  cardBody:       { borderTop: '1px solid #f0f0f0', padding: '8px 12px 10px', background: '#fafafa' },

  // ── Form elements ────────────────────────────────────────────────────────
  checkbox:       { width: 15, height: 15, accentColor: '#1a73e8', flexShrink: 0, cursor: 'pointer' },
  subjectChecked: { color: '#1a73e8' },

  // ── Panel chrome ─────────────────────────────────────────────────────────
  /** Header bar used in App.tsx + SettingsPanel */
  panelHeader:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #e5e5e5' },
};

// ── JobPosts tab ─────────────────────────────────────────────────────────────

export const jobPostsStyles: Record<string, React.CSSProperties> = {
  ...shared,
  staleBanner:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#e8f0fe', border: '1px solid #c5d8fb', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#1a56c4', lineHeight: 1.4 },
  staleLink:          { color: '#1a73e8', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 },
  actionBar:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  selectionHint:      { fontSize: 12, color: '#1a73e8', fontWeight: 600 },
  analyzeAllBtn:      { ...shared.primaryBtn, fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap', flexShrink: 0 },
  analyzeAllDisabled: { background: '#ccc', cursor: 'not-allowed' },
  label:              { flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 },
  subject:            { fontSize: 13, color: '#333', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dateBadge:          { fontSize: 10, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 },
  dateBadgeToday:     { color: '#1a73e8', fontWeight: 600 },
  cardDone:           { opacity: 0.5 },
  doneBadge:          { fontSize: 10, color: '#2e7d32', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 },
  expandBtn:          { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#888', padding: '2px 4px', flexShrink: 0, whiteSpace: 'nowrap' },
  urlList:            { borderTop: '1px solid #f0f0f0', padding: '6px 10px 10px' },
  noUrls:             { fontSize: 12, color: '#888', margin: '4px 0' },
  urlRow:             { padding: '3px 0', borderBottom: '1px solid #f5f5f5' },
  urlText:            { fontSize: 11, color: '#555', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' },
};

// ── Resumes tab ──────────────────────────────────────────────────────────────

export const resumesStyles: Record<string, React.CSSProperties> = {
  ...shared,
  hint:     { fontSize: 12, color: '#1a73e8', fontWeight: 600, marginBottom: 8 },
  label:    { flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  subject:  { fontSize: 13, color: '#333', fontWeight: 500 },
  expandBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#888', padding: '2px 6px', flexShrink: 0 },
  cardBody: { ...shared.cardBody, margin: 0, padding: '8px 12px 12px', fontSize: 11, lineHeight: 1.5, color: '#444', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflowY: 'auto' },
};

// ── Results tab ───────────────────────────────────────────────────────────────

export const resultsStyles: Record<string, React.CSSProperties> = {
  ...shared,
  hint:            { fontSize: 12, color: '#aaa' },
  toolbar:         { display: 'flex', justifyContent: 'flex-end', marginBottom: 8 },
  downloadBtn:     { background: 'none', border: '1px solid #ccc', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#555', cursor: 'pointer' },
  analyzingBanner: { background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#e65100', fontWeight: 600 },
  errorBanner:     { background: '#ffebee', border: '1px solid #f9a8a8', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#c62828' },
  jobGroup:        { marginBottom: 12 },
  jobTitle:        { fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 4, paddingLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardHeader:      { ...shared.cardHeader, cursor: 'pointer' },
  resumeName:      { flex: 1, fontSize: 13, color: '#333', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', gap: 5 },
  jobTag:          { fontSize: 11, color: '#888', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chevron:         { fontSize: 10, color: '#aaa', flexShrink: 0 },
  summary:         { fontSize: 12, color: '#444', lineHeight: 1.6, margin: '0 0 8px' },
  gapsLabel:       { fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 },
  gapsList:        { margin: '0 0 6px', paddingLeft: 18 },
  gapsItem:        { fontSize: 12, color: '#555', lineHeight: 1.6 },
  analyzedAt:      { fontSize: 10, color: '#bbb', marginTop: 6 },
  jobLink:         { display: 'inline-block', fontSize: 11, color: '#1a73e8', marginBottom: 8, textDecoration: 'none' },
};

// ── Settings panel ────────────────────────────────────────────────────────────

export const settingsPanelStyles: Record<string, React.CSSProperties> = {
  ...shared,
  wrap:            { display: 'flex', flexDirection: 'column', height: '100%' },
  loading:         { padding: 16, color: '#888' },
  title:           { fontWeight: 700, fontSize: 15 },
  signOutBtn:      { ...shared.dangerBtn, padding: '4px 10px', marginLeft: 'auto', marginRight: 6 },
  closeBtn:        { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#555' },
  body:            { flex: 1, overflowY: 'auto', padding: '12px 14px' },
  section:         { marginBottom: 20 },
  sectionLabel:    { fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#222' },
  radioRow:        { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' },
  radioLabel:      { fontSize: 13 },
  indent:          { marginLeft: 20, marginTop: 6, marginBottom: 8 },
  fieldLabel:      { fontSize: 12, color: '#555', marginTop: 8, marginBottom: 4 },
  fieldHint:       { fontSize: 11, color: '#aaa', fontWeight: 400 },
  hint:            { fontSize: 11, color: '#888', marginBottom: 6 },
  row:             { display: 'flex', gap: 6, alignItems: 'center' },
  input:           { flex: 1, padding: '5px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 },
  select:          { padding: '5px 8px', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 },
  saveBtn:         { ...shared.primaryBtn, padding: '5px 10px', fontSize: 12 },
  eyeBtn:          { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px' },
  ok:              { fontSize: 11, color: '#2e7d32', marginTop: 4 },
  err:             { fontSize: 11, color: '#c62828', marginTop: 4 },
  waiverBox:       { fontSize: 10, color: '#888', border: '1px solid #e0e0e0', borderRadius: 4, padding: '6px 8px', marginTop: 8, lineHeight: 1.5 },
  devBadge:        { fontSize: 9, fontWeight: 700, color: '#fff', background: '#2e7d32', borderRadius: 3, padding: '1px 5px', marginLeft: 4, verticalAlign: 'middle' },
  planRow:         { display: 'flex', gap: 8, marginBottom: 10 },
  planCard:        { flex: 1, border: '1px solid #e0e0e0', borderRadius: 6, padding: '8px 10px' },
  planCardPro:     { borderColor: '#1a73e8' },
  planName:        { fontWeight: 700, fontSize: 13, marginBottom: 2 },
  planPrice:       { fontSize: 18, fontWeight: 700, color: '#1a73e8' },
  planPer:         { fontSize: 12, fontWeight: 400, color: '#888' },
  planDetail:      { fontSize: 11, color: '#666', margin: '4px 0 8px' },
  subscribeBtn:    { width: '100%', padding: '5px 0', fontSize: 12, background: '#f1f3f4', color: '#1a73e8', border: '1px solid #1a73e8', borderRadius: 4, cursor: 'pointer' },
  subscribeBtnPro: { background: '#1a73e8', color: '#fff' },
  accountBtn:      { display: 'inline-block', padding: '7px 14px', fontSize: 12, background: '#34a853', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginTop: 6, textDecoration: 'none' },
  modal:           { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modalBox:        { background: '#fff', borderRadius: 8, padding: 20, maxWidth: 340, margin: '0 16px' },
  modalTitle:      { fontWeight: 700, fontSize: 14, marginBottom: 10 },
  modalText:       { fontSize: 12, color: '#444', lineHeight: 1.6, marginBottom: 16 },
  modalBtns:       { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  modalCancel:     { padding: '6px 12px', fontSize: 12, background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' },
  modalOk:         { ...shared.primaryBtn, padding: '6px 12px', fontSize: 12 },
};

// ── Onboarding screen ────────────────────────────────────────────────────────

export const onboardingStyles: Record<string, React.CSSProperties> = {
  ...shared,
  container:          { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  title:              { fontSize: 17, fontWeight: 700, margin: 0 },
  privacyBox:         { display: 'flex', gap: 8, background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 7, padding: '8px 10px', alignItems: 'flex-start' },
  privacyIcon:        { fontSize: 15, flexShrink: 0, marginTop: 1 },
  privacyHeading:     { fontWeight: 600, fontSize: 12, color: '#2e7d32', marginBottom: 1 },
  privacyText:        { fontSize: 11, color: '#388e3c', lineHeight: 1.4 },
  mainRow:            { display: 'flex', gap: 10, alignItems: 'flex-start' },
  labelBlocks:        { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  labelBlock:         { background: '#f5f5f5', borderRadius: 6, padding: '8px 10px' },
  labelBlockHalf:     {},
  labelHeader:        { marginBottom: 6 },
  code:               { background: '#e8f0fe', color: '#1a73e8', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 },
  inlineCode:         { background: '#e8f0fe', color: '#1a73e8', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 10 },
  steps:              { margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#444', lineHeight: 1.4 },
  actions:            { display: 'flex', flexDirection: 'column', gap: 7 },
  link:               { fontSize: 12, color: '#1a73e8', textDecoration: 'none' },
  btn:                { ...shared.primaryBtn, padding: '8px 14px', fontSize: 13 },
};
