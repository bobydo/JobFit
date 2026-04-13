import { AUTH_REQUIRED_DOMAINS } from '../../config';

/**
 * Check whether the user is currently signed in to a job site by looking
 * for known auth cookies across all configured domains. Returns true if any
 * auth cookie is present (covers regional TLDs like glassdoor.ca vs .com).
 */
export async function checkSiteSignIn(cfg: { cookieDomains: string[]; authCookies: string[] }): Promise<boolean> {
  const perDomain = await Promise.all(
    cfg.cookieDomains.map(domain => new Promise<chrome.cookies.Cookie[]>(resolve =>
      chrome.cookies.getAll({ domain }, resolve)
    ))
  );
  return perDomain.flat().some(c => cfg.authCookies.includes(c.name));
}

/**
 * Re-check sign-in status for all configured job sites by querying auth cookies.
 * Object.entries(AUTH_REQUIRED_DOMAINS).map(async ([hostname, cfg])
 * 'linkedin.com'  is "key" and cookieDomains: ['.linkedin.com'], authCookies: ['li_at'] is "value"
 * AUTH_REQUIRED_DOMAINS maps hostname → { cookieDomains, authCookies, ... }:
 *   'linkedin.com'  → cookieDomains: ['.linkedin.com'],                    authCookies: ['li_at']
 *   'indeed.com'    → cookieDomains: ['.indeed.com'],                      authCookies: ['PPID', 'SOCK']
 *   'glassdoor.com' → cookieDomains: ['.glassdoor.com', '.glassdoor.ca'],  authCookies: ['at']
 */
export async function recheckSites(
  setSiteChecking: (v: boolean) => void,
  setSiteStatus: (v: Record<string, boolean>) => void,
): Promise<void> {
  setSiteChecking(true);
  setSiteStatus({});
  const results: Record<string, boolean> = {};
  await Promise.all(
    Object.entries(AUTH_REQUIRED_DOMAINS).map(async ([hostname, cfg]) => {
      results[hostname] = await checkSiteSignIn(cfg);
    })
  );
  setSiteStatus(results);
  setSiteChecking(false);
}
