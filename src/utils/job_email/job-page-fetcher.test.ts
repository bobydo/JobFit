import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractCandidateUrls } from './job-page-fetcher';

// Plain-text representation of a real LinkedIn job alert email.
// These are the actual URLs that appear in the email body.
const LINKEDIN_ALERT_TEXT = `
https://www.linkedin.com/comm/jobs/view/4397185861/?trackingId=Eedkgtb4LNRpDCVEdXtaOg%3D%3D&refId=KE8yTrc4Bzl5u%2FuMnYUeuQ%3D%3D&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_0_jobid_4397185861_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_0_jobid_4397185861_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/view/4396595654/?trackingId=ZetFKwKRM5Q%2Bpijk%2FTQugQ%3D%3D&refId=KE8yTrc4Bzl5u%2FuMnYUeuQ%3D%3D&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_1_jobid_4396595654_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_1_jobid_4396595654_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/view/4383972019/?trackingId=RXDIdTiExVBedYjBdcZPoQ%3D%3D&refId=KE8yTrc4Bzl5u%2FuMnYUeuQ%3D%3D&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_2_jobid_4383972019_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_2_jobid_4383972019_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/view/4384386944/?trackingId=J%2BkvgvcEFSnJiCfoEv5Ipg%3D%3D&refId=KE8yTrc4Bzl5u%2FuMnYUeuQ%3D%3D&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_3_jobid_4384386944_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_3_jobid_4384386944_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/view/4372626306/?trackingId=I16fgPloGTq6cc8cX%2FoEnA%3D%3D&refId=KE8yTrc4Bzl5u%2FuMnYUeuQ%3D%3D&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_4_jobid_4372626306_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_4_jobid_4372626306_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/view/4397528264/?trackingId=w27DM38ycKIgcVeKX31Acg%3D%3D&refId=KE8yTrc4Bzl5u%2FuMnYUeuQ%3D%3D&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_5_jobid_4397528264_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-jobcard_body_text_5_jobid_4397528264_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/search?keywords=application+developer&distance=25&geoId=101174742&f_TPR=a1775139458-&sortBy=R&origin=JOB_ALERT_EMAIL&originToLandingJobPostings=4397185861,4396595654,4397565525,4383972019,4384386944,4372626306&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-primary_job_list-0-see_all_jobs_text_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-primary_job_list-0-see_all_jobs_text_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/premium/products/?upsellOrderOrigin=email_job_alert_digest_taj_upsell&utype=job&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-job~alert-0-freemium~taj~static~upsell~text&trkEmail=eml-email_job_alert_digest_01-job~alert-0-freemium~taj~static~upsell~text-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/help/linkedin/answer/4788?lang=en&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-SecurityHelp-0-textfooterglimmer&trkEmail=eml-email_job_alert_digest_01-SecurityHelp-0-textfooterglimmer-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/comm/jobs/alerts?lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-footer-0-manage_alerts_button_text_ssid_935017946_fmid_a71rx~mnl33c7p~kq&trkEmail=eml-email_job_alert_digest_01-footer-0-manage_alerts_button_text_ssid_935017946_fmid_a71rx~mnl33c7p~kq-null-a71rx~mnl33c7p~kq-null-null&eid=a71rx-mnl33c7p-kq&otpToken=MTMwMjFmZTIxNzJlY2NjN2JlMmYwMmVkNDMxZGUyYjY4YWM3ZDg0MDkxYWI4NTY5NzhjMDA2Njk0YTViNWVmM2ZjODk5MjlkNzBmMGQxZmE1ZjQyZTg3MDlkZTkyNTZlODNjNzM5NDg1YzVjNDc3OGE0LDEsMQ%3D%3D
https://www.linkedin.com/job-alert-email-unsubscribe?savedSearchId=935017946&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&ek=email_job_alert_digest_01&e=a71rx-mnl33c7p-kq&eid=a71rx-mnl33c7p-kq&m=unsubscribe&ts=footerGlimmer&li=0&t=plh
https://www.linkedin.com/help/linkedin/answer/67?lang=en&lipi=urn%3Ali%3Apage%3Aemail_email_job_alert_digest_01%3BcVJzob5rQPmOIR7mSKXH5g%3D%3D&midToken=AQFo1lJVu_htuQ&midSig=10kpLOx7LpvIc1&trk=eml-email_job_alert_digest_01-SecurityHelp-0-textfooterglimmer&trkEmail=eml-email_job_alert_digest_01-SecurityHelp-0-textfooterglimmer-null-a71rx~mnl33c7p~kq-null-null
`;

describe('extractCandidateUrls', () => {
  it('keeps LinkedIn /jobs/view/ URLs', () => {
    const result = extractCandidateUrls(LINKEDIN_ALERT_TEXT);
    expect(result.some((u) => u.includes('/jobs/view/4397185861/'))).toBe(true);
    expect(result.some((u) => u.includes('/jobs/view/4396595654/'))).toBe(true);
    expect(result.some((u) => u.includes('/jobs/view/4383972019/'))).toBe(true);
    expect(result.some((u) => u.includes('/jobs/view/4384386944/'))).toBe(true);
    expect(result.some((u) => u.includes('/jobs/view/4372626306/'))).toBe(true);
    expect(result.some((u) => u.includes('/jobs/view/4397528264/'))).toBe(true);
  });

  it('drops /premium/products/ (no job keyword in path)', () => {
    const result = extractCandidateUrls(LINKEDIN_ALERT_TEXT);
    expect(result.some((u) => u.includes('/premium/products/'))).toBe(false);
  });

  it('drops /help/linkedin/answer/ URLs', () => {
    const result = extractCandidateUrls(LINKEDIN_ALERT_TEXT);
    expect(result.some((u) => u.includes('/help/linkedin/answer/'))).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(extractCandidateUrls('')).toEqual([]);
  });

  it('deduplicates identical URLs', () => {
    const url = 'https://example.com/jobs/view/123';
    const result = extractCandidateUrls(`${url}\n${url}\n${url}`);
    expect(result.filter((u) => u === url)).toHaveLength(1);
  });

  // Snapshot: print all extracted URLs so failures show exactly what changed
  it('snapshot of extracted URLs from LinkedIn alert email', () => {
    const result = extractCandidateUrls(LINKEDIN_ALERT_TEXT);
    // Strip tracking params for readability — just check the path portion
    const paths = result.map((u) => new URL(u).pathname);
    expect(paths).toMatchSnapshot();
  });
});

// ── Indeed job alert email URL resolution ────────────────────────────────────
// apply.indeed.com?next=... links use one-time iaUid/apiToken tokens.
// extractCandidateUrls must resolve these to the canonical viewjob URL so
// fetchJobPageViaTab opens the real job page instead of consuming the token.

const INDEED_HTML_PATH = resolve(__dirname, '../../test_data/indeedJobUrl.html');
const indeedHtml = readFileSync(INDEED_HTML_PATH, 'utf-8');
// Extract href URL and normalise &amp; → & (mirrors extractCandidateUrls behaviour)
const hrefMatch = indeedHtml.match(/href="(https:\/\/apply\.indeed\.com[^"]+)"/);
const applyUrl = hrefMatch![1].replace(/&amp;/g, '&');

describe('extractCandidateUrls — Indeed email redirect resolution', () => {
  it('resolves apply.indeed.com?next= to the canonical viewjob URL', () => {
    const result = extractCandidateUrls(applyUrl);
    expect(result.some((u) => u.includes('viewjob?jk=5a27122fc2cab829'))).toBe(true);
  });

  it('does not return the apply.indeed.com tracking URL', () => {
    const result = extractCandidateUrls(applyUrl);
    expect(result.some((u) => u.includes('apply.indeed.com'))).toBe(false);
  });
});

// ── Indeed plain-text body has no job link ────────────────────────────────────
// Indeed application confirmation emails are multipart/alternative.
// The text/plain part contains only a utility "contact us" link — no job link.
// This test documents that bug so the fix (reading HTML part too) stays in place.

const INDEED_TEXT_PATH = resolve(__dirname, '../../test_data/indeedJobText.txt');
const indeedPlainText = readFileSync(INDEED_TEXT_PATH, 'utf-8');

describe('extractCandidateUrls — Indeed plain-text body', () => {
  it('finds no job link in the plain-text part (documents why HTML part must also be read)', () => {
    const result = extractCandidateUrls(indeedPlainText);
    expect(result.some((u) => u.includes('viewjob'))).toBe(false);
  });
});
