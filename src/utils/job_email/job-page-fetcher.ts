import { jobSiteRegistry } from './job-url-parsers';
import { AUTH_REQUIRED_DOMAINS } from '../../config';

export interface JobPageData {
  title: string;
  body: string;
}

export class JobPageFetcher {
  private static readonly _TAB_TIMEOUT_MS = 25_000;
  private static readonly _POLL_INTERVAL  = 500;
  private static readonly _STABLE_NEEDED  = 2;
  private static readonly _MAX_POLLS      = 16;
  private static readonly _PAGE_MAX_CHARS = 6000;

  async fetchStatic(url: string): Promise<JobPageData | null> {
    if (this._requiresAuthTab(url)) return null;
    const res  = await fetch(url);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');

    for (const el of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        const data = JSON.parse(el.textContent ?? '');
        const entries: unknown[] = Array.isArray(data) ? data : [data];
        for (const entry of entries) {
          const obj = entry as Record<string, unknown>;
          if (obj['@type'] !== 'JobPosting') continue;

          const title = typeof obj.title === 'string' ? obj.title : doc.title.trim() || url;
          const org   = obj.hiringOrganization as Record<string, unknown> | undefined;
          const loc   = obj.jobLocation       as Record<string, unknown> | undefined;
          const addr  = loc?.address          as Record<string, unknown> | undefined;

          const hiringOrg = typeof org?.name          === 'string' ? `Company: ${org.name}\n`              : '';
          const location  = typeof addr?.addressLocality === 'string' ? `Location: ${addr.addressLocality}\n` : '';
          const description = typeof obj.description  === 'string'
            ? obj.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : '';

          return { title, body: `${hiringOrg}${location}${description}` };
        }
      } catch { /* malformed JSON-LD — skip */ }
    }

    const title = doc.title.trim() || url;
    for (const tag of ['script', 'style', 'nav', 'header', 'footer', 'noscript']) {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    }
    const body = (doc.body?.textContent ?? '')
      .replace(/\s{3,}/g, '\n\n')
      .trim()
      .slice(0, JobPageFetcher._PAGE_MAX_CHARS);

    return body ? { title, body } : null;
  }

  async fetchDynamic(url: string): Promise<JobPageData | null> {
    return new Promise((resolve) => {
      chrome.tabs.create({ url, active: false }, (tab) => {
        if (!tab.id) { resolve(null); return; }
        const tabId = tab.id;

        const timeout = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.remove(tabId, () => {});
          resolve(null);
        }, JobPageFetcher._TAB_TIMEOUT_MS);

        function onUpdated(id: number, info: chrome.tabs.TabChangeInfo) {
          if (id !== tabId || info.status !== 'complete') return;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          clearTimeout(timeout);

          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: () => {
                const expandPattern = /^(see more|show more|read more|view more|expand|more|\.{3})$/i;
                document.querySelectorAll('button, a, span[role="button"]').forEach((el) => {
                  if (expandPattern.test((el.textContent ?? '').trim())) (el as HTMLElement).click();
                });
              },
            },
            () => {
              const maxChars    = JobPageFetcher._PAGE_MAX_CHARS;
              const pollMs      = JobPageFetcher._POLL_INTERVAL;
              const stableNeeded = JobPageFetcher._STABLE_NEEDED;
              const maxPolls    = JobPageFetcher._MAX_POLLS;
              let lastLength = -1;
              let stableCount = 0;
              let pollCount = 0;

              function poll() {
                chrome.scripting.executeScript(
                  { target: { tabId }, func: () => document.body?.innerText?.length ?? 0 },
                  (results) => {
                    const len = (results?.[0]?.result as number) ?? 0;
                    if (len === lastLength) { stableCount++; } else { stableCount = 0; lastLength = len; }

                    if (stableCount >= stableNeeded || pollCount >= maxPolls) {
                      chrome.scripting.executeScript(
                        {
                          target: { tabId },
                          func: (maxCh: number) => ({
                            title: document.title,
                            body:  (document.body?.innerText ?? '').replace(/\s{3,}/g, '\n\n').trim().slice(0, maxCh),
                          }),
                          args: [maxChars],
                        },
                        (res) => {
                          chrome.tabs.remove(tabId, () => {});
                          const data = res?.[0]?.result as JobPageData | undefined;
                          resolve(data?.body ? data : null);
                        }
                      );
                    } else {
                      pollCount++;
                      setTimeout(poll, pollMs);
                    }
                  }
                );
              }
              setTimeout(poll, pollMs);
            }
          );
        }
        chrome.tabs.onUpdated.addListener(onUpdated);
      });
    });
  }

  extractCandidateUrls(text: string): string[] {
    const matches = (text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) ?? [])
      .map(u => u.replace(/[">)]*$/, ''));

    return [...new Set(
      matches.flatMap((urlStr) => {
        let decodedUrl = urlStr.replace(/&amp;/gi, '&');
        let finalUrl = decodedUrl;
        try {
          let url = new URL(decodedUrl);
          if (url.hostname.includes('google.com') && url.pathname === '/url') {
            const q = url.searchParams.get('q');
            if (q) { finalUrl = decodeURIComponent(q); url = new URL(finalUrl); }
          }
          const resolvedUrl = jobSiteRegistry.resolveJobUrl(finalUrl);
          if (resolvedUrl !== finalUrl) { finalUrl = resolvedUrl; url = new URL(finalUrl); }

          const { pathname } = url;
          if (!pathname || pathname === '/') return [];
          if (jobSiteRegistry.isKnownJobUrl(finalUrl)) return [finalUrl];

          const hasId      = /\/\d+(\/)?$/.test(pathname);
          const hasJobWord = /\/(job|jobs|career|careers|position|positions)\b/i.test(pathname);
          return hasId && hasJobWord ? [finalUrl] : [];
        } catch { return []; }
      })
    )];
  }

  private _requiresAuthTab(url: string): boolean {
    try {
      const { hostname } = new URL(url);
      return Object.keys(AUTH_REQUIRED_DOMAINS).some(
        (d) => hostname === d || hostname.endsWith(`.${d}`)
      );
    } catch { return false; }
  }
}

export const jobPageFetcher = new JobPageFetcher();

// Named exports for existing callers
export const fetchJobPage         = (url: string)  => jobPageFetcher.fetchStatic(url);
export const fetchJobPageViaTab   = (url: string)  => jobPageFetcher.fetchDynamic(url);
export const extractCandidateUrls = (text: string) => jobPageFetcher.extractCandidateUrls(text);
