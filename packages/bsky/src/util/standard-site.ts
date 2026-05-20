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
 * Returns the set of publication AT-URIs referenced by `site` on any of the
 * supplied documents. Loose documents (whose `site` is a web URL) contribute
 * nothing. Returns an empty set when the input is empty.
 *
 * Typed structurally so this util can stay free of the hydration types.
 */
export const collectAllowedPublicationUris = (
  documents: ReadonlyMap<string, { record: { site?: string } } | null>,
): Set<string> => {
  const allowed = new Set<string>()
  for (const info of documents.values()) {
    const site = info?.record.site
    if (site && site.startsWith('at://')) allowed.add(site)
  }
  return allowed
}

/**
 * Parse `url` as HTTP(S) and reduce it to a canonical
 * `protocol://host/path` string for equality comparison: lowercases host,
 * strips a trailing slash from the path, and drops query/fragment. Returns
 * `null` when the input isn't a valid HTTP(S) URL.
 */
const canonicalizeHttpUrl = (url: string, base?: string): string | null => {
  let parsed: URL
  try {
    parsed = new URL(url, base)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
  return `${parsed.protocol}//${parsed.host}${path}`
}

/**
 * Confirm that the supplied SS records actually back `assumedUrl`. URL
 * comparison parses both sides via the WHATWG URL constructor (resolving
 * the document's `path` against the publication or site as a base) and
 * compares the canonical `protocol://host/path` forms — host case is
 * ignored, query/fragment are dropped, trailing slashes stripped.
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
    | { ref: { uri: string }; info: { record: { site: string; path?: string } } }
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
      document.info.record.path ?? '',
      publication.info.record.url,
    )
    return joined === canonicalAssumed
  }
  if (document) {
    const joined = canonicalizeHttpUrl(
      document.info.record.path ?? '',
      document.info.record.site,
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
