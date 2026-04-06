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
            // Wait briefly for expanded content to render, then extract text
            setTimeout(() => {
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
                (results) => {
                  chrome.tabs.remove(tabId, () => {});
                  const data = results?.[0]?.result as JobPageData | undefined;
                  resolve(data?.body ? data : null);
                }
              );
            }, 1500);
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
