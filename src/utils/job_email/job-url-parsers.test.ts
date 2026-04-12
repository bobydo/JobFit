import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isKnownJobUrl, JOB_SITE_PARSERS } from './job-url-parsers';

// Load CSV: ATS,Pattern,Example URL
const CSV_PATH = resolve(__dirname, '../../test_data/job_url_test_dataset.csv');
const csvLines = readFileSync(CSV_PATH, 'utf-8').trim().split('\n').slice(1); // skip header

const testCases = csvLines.map((line) => {
  const [ats, , url] = line.split(',');
  return { ats: ats.trim(), url: url.trim() };
});

describe('isKnownJobUrl — CSV regression tests', () => {
  testCases.forEach(({ ats, url }) => {
    it(`accepts ${ats}: ${url}`, () => {
      expect(isKnownJobUrl(url)).toBe(true);
    });
  });
});

describe('isKnownJobUrl — negative tests (must reject)', () => {
  it('rejects LinkedIn unsubscribe URL', () => {
    expect(isKnownJobUrl('https://www.linkedin.com/job-alert-email-unsubscribe?savedSearchId=123')).toBe(false);
  });
  it('rejects LinkedIn premium URL', () => {
    expect(isKnownJobUrl('https://www.linkedin.com/comm/premium/products/')).toBe(false);
  });
  it('rejects LinkedIn help URL', () => {
    expect(isKnownJobUrl('https://www.linkedin.com/help/linkedin/answer/4788')).toBe(false);
  });
  it('rejects random unsubscribe URL', () => {
    expect(isKnownJobUrl('https://example.com/unsubscribe')).toBe(false);
  });
});

// Load CSV: ATS,URL,Reason
const INVALID_CSV_PATH = resolve(__dirname, '../../test_data/invalid_urls.csv');
const invalidCsvLines = readFileSync(INVALID_CSV_PATH, 'utf-8').trim().split('\n').slice(1);

const invalidCases = invalidCsvLines.map((line) => {
  const [ats, url, reason] = line.split(',');
  return { ats: ats.trim(), url: url.trim(), reason: reason.trim() };
});

describe('isKnownJobUrl — CSV invalid URL tests (must reject)', () => {
  invalidCases.forEach(({ ats, url, reason }) => {
    it(`rejects ${ats} (${reason}): ${url}`, () => {
      expect(isKnownJobUrl(url)).toBe(false);
    });
  });
});

// ── Indeed URL variants (from indeedJobUrl.html) ────────────────────────────
// Fixture uses raw email HTML (no Gmail web-UI data-saferedirecturl wrapper).
const INDEED_HTML_PATH = resolve(__dirname, '../../test_data/indeedJobUrl.html');
const indeedHtml = readFileSync(INDEED_HTML_PATH, 'utf-8');

// Extract href URL and normalise &amp; → & (mirrors extractCandidateUrls behaviour)
const hrefMatch = indeedHtml.match(/href="(https:\/\/apply\.indeed\.com[^"]+)"/);
const applyUrl  = hrefMatch![1].replace(/&amp;/g, '&');

const indeedParser = JOB_SITE_PARSERS['indeed.com'];

describe('indeed.com parser — returns job ID (from indeedJobUrl.html)', () => {
  it('extracts jk from apply.indeed.com via ?next= redirect', () => {
    expect(indeedParser(new URL(applyUrl))).toBe('5a27122fc2cab829');
  });

  it('returns null for google.com safe-redirect wrapper (not an indeed.com host)', () => {
    const googleUrl = 'https://www.google.com/url?q=https%3A%2F%2Fapply.indeed.com%2F&source=gmail';
    expect(indeedParser(new URL(googleUrl))).toBeNull();
  });

  it('returns null for apply.indeed.com with no next param', () => {
    expect(indeedParser(new URL('https://apply.indeed.com/indeedapply/form?iaUid=123'))).toBeNull();
  });
});
