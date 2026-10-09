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
  'adf.ly',
  'bit.ly',
  'bitly.com',
  'bl.ink',
  'buff.ly',
  'clck.ru',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'lnkd.in',
  'ow.ly',
  'rb.gy',
  'rebrand.ly',
  's.id',
  'short.gy',
  'shorturl.at',
  't.co',
  't.ly',
  'tiny.cc',
  'tinyurl.com',
  'v.gd',
  'x.gd',
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
