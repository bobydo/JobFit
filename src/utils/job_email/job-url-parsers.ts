function on(domain: string, hostname: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * JOB_SITE_PARSERS
 *
 * A map of domain suffix → parser function.
 * Each parser receives a URL object and returns:
 *   - a non-null string (job ID or 'accept') if this is a valid job URL
 *   - null to reject the URL
 *
 * To add a new site: add one entry here. Domain is matched with on().
 */
export const JOB_SITE_PARSERS: Record<string, (url: URL) => string | null> = {
  // ── Job boards ──────────────────────────────────────────────────────────
  'indeed.com': (url) => {
  // apply.indeed.com wraps the real listing in a ?next= redirect param
    try {
      // Only handle indeed domains
      if (!url.hostname.includes('indeed.com')) return null;

      // 1. Direct jk (most common)
      const jk = url.searchParams.get('jk');
      if (jk) return jk;

      // 2. Nested in `next`
      const next = url.searchParams.get('next');
      if (next) {
        try {
          const decoded = next.startsWith('http')
            ? next
            : decodeURIComponent(next);
          const nested = new URL(decoded);
          console.log(`[indeed.com parser] nested URL: ${nested.href}`);
          return nested.searchParams.get('jk');
        } catch {}
      }
      // 3. Nothing found
      return null;
    } catch {
      return null;
    }
  },
  'linkedin.com':        (url) => {
    const m = url.pathname.match(/\/jobs\/view\/(?:[\w-]+-)?(\d+)/);
    console.log(`[linkedin.com parser] URL: ${url.href}, match: ${m?.[1]}`);
    return m?.[1] ?? null;
  },
  'glassdoor.com':       (_url) => 'accept',
  'monster.com':         (_url) => 'accept',
  'ziprecruiter.com':    (_url) => 'accept',
  'workopolis.com':      (_url) => 'accept',

  // ── ATS platforms ───────────────────────────────────────────────────────
  'myworkdayjobs.com':   (url) => {
    const m = url.pathname.match(/_((?:JR-)?[\w\d-]+)(?:\?|$)/);
    return m?.[1] ?? null;
  },
  'greenhouse.io':       (url) => {
    const m = url.pathname.match(/\/jobs\/(\d+)/);
    return m?.[1] ?? url.searchParams.get('gh_jid');
  },
  'lever.co':            (url) => {
    const m = url.pathname.match(/\/[\w-]+\/([a-zA-Z0-9-]{6,})/);
    return m?.[1] ?? null;
  },
  'icims.com':           (url) => {
    const m = url.pathname.match(/\/jobs\/(\d+)/);
    return m?.[1] ?? url.searchParams.get('job') ?? url.searchParams.get('id');
  },
  'taleo.net':           (url) => url.searchParams.get('job') ?? url.searchParams.get('reqnum'),
  'bamboohr.com':        (url) => {
    const m = url.pathname.match(/\/(?:careers|jobs\/view\.php).*?(\d+)/);
    return m?.[1] ?? url.searchParams.get('id');
  },
  'smartrecruiters.com': (url) => {
    const m = url.pathname.match(/\/(\d+)-/);
    return m?.[1] ?? null;
  },
  'ashbyhq.com':         (url) => {
    const m = url.pathname.match(/\/([a-z0-9-]{8,})/i);
    return m?.[1] ?? null;
  },
  'successfactors.eu':   (url) => url.searchParams.get('job'),
  'successfactors.com':  (url) => url.searchParams.get('job'),
  'jobs.sap.com':        (url) => { const m = url.pathname.match(/\/(\d+)/); return m?.[1] ?? null; },
  'oraclecloud.com':     (url) => { const m = url.pathname.match(/\/(\d+)/); return m?.[1] ?? null; },
  'applytojob.com':      (_url) => 'accept',
  'paylocity.com':       (url) => { const m = url.pathname.match(/\/(\d+)/); return m?.[1] ?? null; },
  'adp.com':             (url) => url.searchParams.get('jobId'),
  'ultipro.com':         (url) => { const m = url.pathname.match(/\/([A-Z0-9]+)$/i); return m?.[1] ?? null; },
  'jobvite.com':         (url) => { const m = url.pathname.match(/\/job\/([a-zA-Z0-9]+)/); return m?.[1] ?? null; },

  // ── Staffing agencies ───────────────────────────────────────────────────
  'teemagroup.com':      (_url) => 'accept',
  'staffingfuture.com':  (_url) => 'accept',
};


/** Returns true if the URL matches a known job site and passes its parser. 
 * add a helper function like on(domain, hostname) to replace the inline hostname 
 * check in isKnownJobUrl, keep everything else the same
 *
 * I'm most effective when the developer:
 * Knows what they want — even roughly ("add a helper", "keep the same pattern")
 * Shows an example — a snippet of the desired output removes ambiguity instantly
 * Sets scope explicitly — "change only this function" prevents me from over-engineering
*/
export function isKnownJobUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const domainKey = Object.keys(JOB_SITE_PARSERS).find((d) => on(d, url.hostname));
    if (!domainKey) {
      console.log(`[isKnownJobUrl] no match — hostname: ${url.hostname}`);
      return false;
    }
    const result = JOB_SITE_PARSERS[domainKey](url);
    console.log(`[isKnownJobUrl] ${url.hostname} → domainKey: ${domainKey}, result: ${JSON.stringify(result)}`);
    return result !== null;
  } catch (e) {
    console.log(`[isKnownJobUrl] invalid URL: ${urlStr} — ${e}`);
    return false;
  }
}
