// Where a visit came from, for the stats dashboard: a tagged link (?ref=reddit or
// utm_source), the site that linked here, itch.io, the installed app, or nothing (direct).
// Only the site's name is kept, never the page or anything about the visitor.

/** Sites grouped under one name, so reddit.com, old.reddit.com and out.reddit.com count together. */
const SITES: [RegExp, string][] = [
  [/(^|\.)reddit\.com$|(^|\.)redd\.it$/, 'reddit'],
  [/^t\.co$|(^|\.)x\.com$|(^|\.)twitter\.com$/, 'x'],
  [/(^|\.)itch\.io$|(^|\.)itch\.zone$/, 'itch'],
  [/(^|\.)discord(app)?\.(com|gg)$/, 'discord'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)yahoo\.com$|(^|\.)ecosia\.org$|(^|\.)brave\.com$/, 'search'],
  [/(^|\.)facebook\.com$|^fb\.(com|me)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)ycombinator\.com$/, 'hackernews'],
  [/(^|\.)newgrounds\.com$/, 'newgrounds'],
  [/(^|\.)github\.(com|io)$/, 'github'],
  [/(^|\.)bsky\.app$/, 'bluesky'],
  [/(^|\.)threads\.net$/, 'threads'],
  [/(^|\.)ko-fi\.com$/, 'kofi'],
];

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);

export interface VisitSource {
  /** The grouped name: 'reddit', 'x', 'direct', or a site's own host. */
  source: string;
  /** The referring site's host, when there was one. */
  host: string;
}

export function trafficSource(url: string, referrer: string, opts: { itch?: boolean; app?: boolean } = {}): VisitSource {
  let here = '';
  try {
    const u = new URL(url);
    here = u.hostname;
    const tag = clean(u.searchParams.get('ref') || u.searchParams.get('utm_source') || '');
    if (tag) return { source: tag, host: '' };
  } catch {
    // Not a URL we can read: fall through to the referrer.
  }
  if (opts.itch) return { source: 'itch', host: '' };
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.replace(/^www\./, '').toLowerCase() : '';
  } catch {
    host = '';
  }
  // Coming back from our own pages (or sign-in) isn't a new source.
  if (!host || host === here.replace(/^www\./, '') || /(^|\.)onemorecrypt\.com$|supabase\.co$/.test(host)) {
    return { source: opts.app ? 'app' : 'direct', host: '' };
  }
  const site = SITES.find(([re]) => re.test(host));
  return { source: site ? site[1] : clean(host) || 'other', host: clean(host) };
}
