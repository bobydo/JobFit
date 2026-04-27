export const JOB_SITE_PARSERS: Record<string, (url: URL) => string | null> = {
  // ── Job boards ──────────────────────────────────────────────────────────
  'indeed.com': (url) => {
    try {
      if (!url.hostname.includes('indeed.com')) return null;
      const jk = url.searchParams.get('jk');
      if (jk) return jk;
      const next = url.searchParams.get('next');
      if (next) {
        try {
          const decoded = next.startsWith('http') ? next : decodeURIComponent(next);
          return new URL(decoded).searchParams.get('jk');
        } catch {}
      }
      return null;
    } catch { return null; }
  },
  'linkedin.com':        (url) => url.pathname.match(/\/jobs\/view\/(?:[\w-]+-)?(\d+)/)?.[1] ?? null,
  'glassdoor.com':       (_url) => 'accept',
  'monster.com':         (_url) => 'accept',
  'ziprecruiter.com':    (_url) => 'accept',
  'workopolis.com':      (_url) => 'accept',

  // ── ATS platforms ───────────────────────────────────────────────────────
  'myworkdayjobs.com':   (url) => url.pathname.match(/_((?:JR-)?[\w\d-]+)(?:\?|$)/)?.[1] ?? null,
  'greenhouse.io':       (url) => url.pathname.match(/\/jobs\/(\d+)/)?.[1] ?? url.searchParams.get('gh_jid'),
  'lever.co':            (url) => url.pathname.match(/\/[\w-]+\/([a-zA-Z0-9-]{6,})/)?.[1] ?? null,
  'icims.com':           (url) => url.pathname.match(/\/jobs\/(\d+)/)?.[1] ?? url.searchParams.get('job') ?? url.searchParams.get('id'),
  'taleo.net':           (url) => url.searchParams.get('job') ?? url.searchParams.get('reqnum'),
  'bamboohr.com':        (url) => url.pathname.match(/\/(?:careers|jobs\/view\.php).*?(\d+)/)?.[1] ?? url.searchParams.get('id'),
  'smartrecruiters.com': (url) => url.pathname.match(/\/(\d+)-/)?.[1] ?? null,
  'ashbyhq.com':         (url) => url.pathname.match(/\/([a-z0-9-]{8,})/i)?.[1] ?? null,
  'successfactors.eu':   (url) => url.searchParams.get('job'),
  'successfactors.com':  (url) => url.searchParams.get('job'),
  'jobs.sap.com':        (url) => url.pathname.match(/\/(\d+)/)?.[1] ?? null,
  'oraclecloud.com':     (url) => url.pathname.match(/\/(\d+)/)?.[1] ?? null,
  'applytojob.com':      (_url) => 'accept',
  'paylocity.com':       (url) => url.pathname.match(/\/(\d+)/)?.[1] ?? null,
  'adp.com':             (url) => url.searchParams.get('jobId'),
  'ultipro.com':         (url) => url.pathname.match(/\/([A-Z0-9]+)$/i)?.[1] ?? null,
  'jobvite.com':         (url) => url.pathname.match(/\/job\/([a-zA-Z0-9]+)/)?.[1] ?? null,

  // ── Staffing agencies ───────────────────────────────────────────────────
  'teemagroup.com':      (_url) => 'accept',
  'staffingfuture.com':  (_url) => 'accept',
};

const _redirectResolvers: Record<string, (url: URL) => URL> = {
  'indeed.com': (url) => {
    const next = url.searchParams.get('next');
    if (!next) return url;
    const resolved = next.startsWith('http') ? next : decodeURIComponent(next);
    try { return new URL(resolved); } catch { return url; }
  },
};

function _on(domain: string, hostname: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export class JobSiteRegistry {
  isKnownJobUrl(urlStr: string): boolean {
    try {
      const url = new URL(urlStr);
      const key = Object.keys(JOB_SITE_PARSERS).find((d) => _on(d, url.hostname));
      if (!key) return false;
      return JOB_SITE_PARSERS[key](url) !== null;
    } catch { return false; }
  }

  resolveJobUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      const key = Object.keys(_redirectResolvers).find((d) => _on(d, url.hostname));
      if (!key) return urlStr;
      const resolved = _redirectResolvers[key](url);
      return resolved !== url ? resolved.href : urlStr;
    } catch { return urlStr; }
  }
}

export const jobSiteRegistry = new JobSiteRegistry();

// Named exports for existing callers
export const isKnownJobUrl = (url: string) => jobSiteRegistry.isKnownJobUrl(url);
export const resolveJobUrl = (url: string) => jobSiteRegistry.resolveJobUrl(url);
