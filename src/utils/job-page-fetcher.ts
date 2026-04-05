export interface JobPageData {
  title: string;
  body: string;
}

/**
 * Fetch a URL and check for Schema.org JobPosting structured data.
 * Returns job content if the page is a real job posting, null otherwise.
 */
export async function fetchJobPage(url: string): Promise<JobPageData | null> {
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(el.textContent ?? '');
      const entries: unknown[] = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        const obj = entry as Record<string, unknown>;
        if (obj['@type'] !== 'JobPosting') continue;

        const title = typeof obj.title === 'string' ? obj.title : doc.title.trim() || url;

        const org = (obj.hiringOrganization as Record<string, unknown> | undefined);
        const hiringOrg = typeof org?.name === 'string' ? `Company: ${org.name}\n` : '';

        const loc = (obj.jobLocation as Record<string, unknown> | undefined);
        const addr = (loc?.address as Record<string, unknown> | undefined);
        const location = typeof addr?.addressLocality === 'string'
          ? `Location: ${addr.addressLocality}\n` : '';

        const description = typeof obj.description === 'string'
          ? obj.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';

        return { title, body: `${hiringOrg}${location}${description}` };
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }

  // No JobPosting schema found — not a real job posting page
  return null;
}

/**
 * Extract candidate URLs from raw email body text.
 */
export function extractCandidateUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) ?? [];

  return [...new Set(matches)].filter((urlStr) => {
    try {
      const url = new URL(urlStr);
      const { pathname } = url;

      if (!pathname || pathname === '/') return false;

      // ✅ Strong signal: ends with numeric ID (most job pages)
      const hasId = /\/\d+(\/)?$/.test(pathname);

      // ✅ Must contain job-related segment
      const hasJobWord = /\/(job|jobs|career|careers|position|positions)\b/i.test(pathname);

      return hasId && hasJobWord;
    } catch {
      return false;
    }
  });
}
