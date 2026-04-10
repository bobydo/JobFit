import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { isKnownJobUrl } from './job-url-parsers';

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
