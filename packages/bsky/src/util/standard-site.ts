import { AtUriString } from '@atproto/syntax'

export const SITE_STANDARD_NSID_PREFIX = 'site.standard.'

/**
 * Composes a stable map key from an `(uri, cid)` pair. A single hydration
 * batch can pull more than one version of the same SS record URI (different
 * posts pinning different cids), so the composite is needed for O(1)
 * version-exact lookups.
 */
export const siteStandardRecordKey = (uri: string, cid: string) =>
  `${uri}@${cid}`

export const parseSiteStandardRecordKey = (
  key: string,
): { uri: AtUriString; cid: string } => {
  const at = key.lastIndexOf('@')
  return {
    uri: key.slice(0, at) as AtUriString,
    cid: key.slice(at + 1),
  }
}

/**
 * Parse `url` as HTTP(S) and reduce it to a canonical
 * `protocol://host/path` string for equality comparison: lowercases host,
 * strips a trailing slash from the path, and drops query/fragment. Returns
 * `null` when the input isn't a valid HTTP(S) URL.
 */
const canonicalizeHttpUrl = (url: string): string | null => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
  return `${parsed.protocol}//${parsed.host}${path}`
}

/**
 * Append `path` to `base` with exactly one slash between, or return `base`
 * unchanged when `path` is empty. Unlike `new URL(path, base)`, a leading
 * slash on `path` does NOT swallow `base`'s pathname — so
 * `joinPath('https://x.com/blog', '/foo')` is `https://x.com/blog/foo`,
 * not `https://x.com/foo`.
 */
const joinPath = (base: string, path: string): string => {
  if (!path) return base
  const baseTrimmed = base.endsWith('/') ? base.slice(0, -1) : base
  const pathTrimmed = path.startsWith('/') ? path.slice(1) : path
  return `${baseTrimmed}/${pathTrimmed}`
}

/**
 * Confirm that the supplied SS records actually back `assumedUrl`. The
 * record-side URL is built by concatenating the publication URL (or the
 * loose-doc site) with the document's `path` field, then both sides are
 * canonicalized for equality: lowercase host, query/fragment dropped,
 * trailing slash stripped.
 *
 * Path concatenation is `base + '/' + path` semantics — a leading `/` on
 * `path` does NOT swallow the base's pathname (the way
 * `new URL(path, base)` would). So
 * `'https://atproto.com/blog' + '/indexing-standard-site'` resolves to
 * `https://atproto.com/blog/indexing-standard-site` regardless of which
 * side carries the slash.
 *
 * Structural validation of the doc/pub pair (matching `site` ↔ pub URI,
 * no orphan docs that claim a missing publication) happens upstream in
 * `getSiteStandardRecordsFromHydrationMapsByRefs` /
 * `…ByDocumentUri` (see `hydration/external.ts`); by the time this
 * function runs the pair is already known to be structurally consistent,
 * so we only check whether the records back the URL.
 *
 * Cases:
 * - Document + publication: `publication.url + document.path` must
 *   canonicalize to `assumedUrl`.
 * - Loose document (web-URL `site`): `document.site + document.path`
 *   must canonicalize to `assumedUrl`. (Doc with at-uri `site` but no
 *   publication can't reach this function — the lookups reject it.)
 * - Publication only: `publication.url` must canonicalize to
 *   `assumedUrl`.
 * - Neither: vacuously valid; the caller short-circuits before we get
 *   here.
 */
export const validateStandardSiteForUrl = (
  document:
    | {
        ref: { uri: string }
        info: { record: { site: string; path?: string } }
      }
    | undefined,
  publication:
    | { ref: { uri: string }; info: { record: { url: string } } }
    | undefined,
  assumedUrl: string,
): boolean => {
  const canonicalAssumed = canonicalizeHttpUrl(assumedUrl)
  if (canonicalAssumed === null) return false

  if (document && publication) {
    const joined = canonicalizeHttpUrl(
      joinPath(publication.info.record.url, document.info.record.path ?? ''),
    )
    return joined === canonicalAssumed
  }
  if (document) {
    const joined = canonicalizeHttpUrl(
      joinPath(document.info.record.site, document.info.record.path ?? ''),
    )
    return joined === canonicalAssumed
  }
  if (publication) {
    return canonicalizeHttpUrl(publication.info.record.url) === canonicalAssumed
  }
  return true
}

const WORDS_PER_MINUTE = 200

/**
 * Estimate reading time in minutes from a plaintext document body. Returns
 * `undefined` when the input has no countable words. Uses a coarse
 * `WORDS_PER_MINUTE` heuristic; swap in a more accurate library here if
 * needed (e.g. `reading-time`).
 */
export const estimateReadingTimeMinutes = (
  text: string,
): number | undefined => {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (!words) return undefined
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}
