// Server-side rules for profile link destinations. Clients enforce the same
// rules when a link is saved, but any client can write a link record, so
// links that break them are left out of profile views.

/** Profiles show at most this many links, in the order the profile lists them. */
export const MAX_PROFILE_LINKS = 10

/**
 * General-purpose URL shorteners, which hide where a link goes. A brand's own
 * short links (youtu.be, amzn.to) only lead to that brand, so they aren't
 * listed. Kept in sync with the Bluesky app.
 */
export const SHORTENER_DOMAINS = [
  'acel.me',
  'adf.ly',
  'bit.ly',
  'bitly.com',
  'bl.ink',
  'buff.ly',
  'clck.ru',
  'cutt.ly',
  'fc-lc.xyz',
  'goo.gl',
  'goto.now',
  'is.gd',
  'link2.fm',
  'ln.run',
  'lnk.ua',
  'lnkd.in',
  'n9.cl',
  'ow.ly',
  'psee.io',
  'rb.gy',
  'rebrand.ly',
  'rg.by',
  's.id',
  'short.do',
  'short.gy',
  'shorten.as',
  'shorten.ee',
  'shorten.is',
  'shorten.so',
  'shorten.tv',
  'shorten.world',
  'shorter.me',
  'shortn.icu',
  'shorturl.at',
  'shorturl.lt',
  'shorturl.ly',
  'slnt.to',
  'smarturl.lt',
  'smarturl.my',
  'sprl.me',
  'sw.run',
  't.co',
  't.ly',
  'tiny.cc',
  'tinyurl.com',
  'urlr.me',
  'v.gd',
  'x.gd',
  'zig.ht',
]

export function isAllowedProfileLinkUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  return !SHORTENER_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  )
}
