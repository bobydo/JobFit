import { isKnownJobUrl, resolveJobUrl } from './job-url-parsers';

export interface JobPageData {
  title: string;
  body: string;
}

// Sites that require user authentication — skip direct (cookie-less) fetch.
// The caller will use fetchJobPageViaTab which runs in a real browser tab with the user's session.
const AUTH_REQUIRED_DOMAINS = ['linkedin.com', 'indeed.com', 'glassdoor.com'];

function requiresAuthTab(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return AUTH_REQUIRED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Fetch a URL and check for Schema.org JobPosting structured data.
 * Returns job content if the page is a real job posting, null otherwise.
 * Returns null for auth-required domains (e.g. LinkedIn) so the caller falls
 * through to fetchJobPageViaTab which uses the user's real browser session.
 */
export async function fetchJobPage(url: string): Promise<JobPageData | null> {
  if (requiresAuthTab(url)) return null;
  const res = await fetch(url);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const el of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
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

  // No JobPosting schema found — fall back to extracting visible text
  const title = doc.title.trim() || url;

  // Remove script/style/nav/header/footer noise
  for (const tag of ['script', 'style', 'nav', 'header', 'footer', 'noscript']) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }

  const body = (doc.body?.textContent ?? '')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000);

  if (!body) return null;
  return { title, body };
}

/**
 * Fetch a JS-rendered page by opening it in a hidden browser tab.
 * Falls back to null if the tab can't be scripted or body is empty.
 */
export async function fetchJobPageViaTab(url: string): Promise<JobPageData | null> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (!tab.id) { resolve(null); return; }
      const tabId = tab.id;

      // Timeout in case the page never finishes loading
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.remove(tabId, () => {});
        resolve(null);
      }, 25000);

      function onUpdated(id: number, info: chrome.tabs.TabChangeInfo) {
        if (id !== tabId || info.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeout);
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              // Generic expand: click any button/link whose text suggests "show more"
              const expandPattern = /^(see more|show more|read more|view more|expand|more|\.{3})$/i;
              document.querySelectorAll('button, a, span[role="button"]').forEach((el) => {
                if (expandPattern.test((el.textContent ?? '').trim())) {
                  (el as HTMLElement).click();
                }
              });
            },
          },
          () => {
            // Poll until body text stabilizes (JS-rendered pages like Indeed load after 'complete')
            const POLL_INTERVAL = 500;
            const STABLE_NEEDED = 2;  // consecutive equal-length checks → content ready
            const MAX_POLLS = 16;     // 16 × 500ms = 8s hard cap
            let lastLength = -1;
            let stableCount = 0;
            let pollCount = 0;

            function poll() {
              chrome.scripting.executeScript(
                { target: { tabId }, func: () => document.body?.innerText?.length ?? 0 },
                (results) => {
                  const len = (results?.[0]?.result as number) ?? 0;
                  if (len === lastLength) {
                    stableCount++;
                  } else {
                    stableCount = 0;
                    lastLength = len;
                  }

                  if (stableCount >= STABLE_NEEDED || pollCount >= MAX_POLLS) {
                    chrome.scripting.executeScript(
                      {
                        target: { tabId },
                        func: () => ({
                          title: document.title,
                          body: (document.body?.innerText ?? '')
                            .replace(/\s{3,}/g, '\n\n')
                            .trim()
                            .slice(0, 6000),
                        }),
                      },
                      (res) => {
                        chrome.tabs.remove(tabId, () => {});
                        const data = res?.[0]?.result as JobPageData | undefined;
                        resolve(data?.body ? data : null);
                      }
                    );
                  } else {
                    pollCount++;
                    setTimeout(poll, POLL_INTERVAL);
                  }
                }
              );
            }

            setTimeout(poll, POLL_INTERVAL);
          }
        );
      }
      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

/**
 * Extract candidate URLs from raw email body text.
 */
export function extractCandidateUrls(text: string): string[] {
  const matches = (text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) ?? [])
  .map(u => u.replace(/[">)]*$/, ''));

  // flatMap so we can both filter and return the resolved canonical URL
  return [...new Set(
    matches.flatMap((urlStr) => {
      // Normalize HTML entities that appear when body is HTML (e.g. &amp; in href)
      let decodedUrl = urlStr.replace(/&amp;/gi, '&');
      let finalUrl = decodedUrl;
      try {
        let url = new URL(decodedUrl);
        // ✅ unwrap Gmail redirect
        if (url.hostname.includes('google.com') && url.pathname === '/url') {
          const q = url.searchParams.get('q');
          if (q) {
            finalUrl = decodeURIComponent(q);
            url = new URL(finalUrl);
          }
        }
        // ✅ resolve site-specific redirect/tracking URLs to canonical job URLs
        // (e.g. Indeed ?next=, future sites) — logic lives in job-url-parsers.ts
        const resolvedUrl = resolveJobUrl(finalUrl);
        if (resolvedUrl !== finalUrl) {
          finalUrl = resolvedUrl;
          url = new URL(finalUrl);
        }

        const { pathname } = url;
        if (!pathname || pathname === '/') return [];

        // 1. Check known job site parsers (LinkedIn, Indeed, Workday, Greenhouse, etc.)
        if (isKnownJobUrl(finalUrl)) return [finalUrl];

        // 2. Fallback: strict heuristic for unknown domains
        const hasId = /\/\d+(\/)?$/.test(pathname);
        const hasJobWord = /\/(job|jobs|career|careers|position|positions)\b/i.test(pathname);
        return hasId && hasJobWord ? [finalUrl] : [];
      } catch {
        return [];
      }
    })
  )];
}
