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
