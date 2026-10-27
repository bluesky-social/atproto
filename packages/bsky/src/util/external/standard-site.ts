import type { AtUriString, InferInput, RecordSchema } from '@atproto/lex'
import { parseAtUriString } from '@atproto/syntax'
import type {
  AssociatedSiteStandardRecord,
  ExternalRecord,
  ExternalRecords,
  SiteStandardDocument,
  SiteStandardPublication,
} from '../../hydration/external.js'
import type { RecordInfo } from '../../hydration/util.js'
import { site } from '../../lexicons/index.js'

export const SITE_STANDARD_NSID_PREFIX = 'site.standard.'

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
 * Apex domains whose authors own the full subpath space under their
 * record-claimed URL. Each entry matches itself and any subdomain; e.g.
 * `pckt.blog` matches `pckt.blog` and `waow-tech.pckt.blog`.
 *
 * On these domains, an `assumedUrl` whose pathname extends the canonical
 * record URL with extra segments is treated as valid. Adding to this list
 * is a trust call — only platforms where each record's URL space is
 * authoritatively owned by its author belong here.
 */
const SUBPATH_FRIENDLY_DOMAINS = ['pckt.blog', 'leaflet.pub', 'offprint.app']

const isSubpathFriendlyHost = (host: string): boolean => {
  const lower = host.toLowerCase()
  return SUBPATH_FRIENDLY_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith(`.${domain}`),
  )
}

/**
 * Return whether `recordUrl` and `assumedUrl` should validate as the same
 * canonical content. Strictly equal canonical forms always match. On
 * subpath-friendly hosts (see `SUBPATH_FRIENDLY_DOMAINS`), an `assumedUrl`
 * whose path extends `recordUrl`'s with extra segments is also accepted.
 *
 * Both inputs are pre-canonicalized strings (`canonicalizeHttpUrl` output)
 * with no trailing slash and no query/fragment.
 */
const canonicalUrlMatchesAssumed = (
  canonicalRecordUrl: string,
  canonicalAssumedUrl: string,
): boolean => {
  if (canonicalRecordUrl === canonicalAssumedUrl) return true
  // Subpath fallback. Both strings are canonicalized, so a real
  // path-segment boundary at `recordUrl + '/'` (e.g. `/foo` vs `/foo-bar`
  // never matches; `/foo` vs `/foo/bar` does).
  if (!canonicalAssumedUrl.startsWith(`${canonicalRecordUrl}/`)) return false
  let host: string
  try {
    host = new URL(canonicalAssumedUrl).host
  } catch {
    return false
  }
  return isSubpathFriendlyHost(host)
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
 * no orphan docs that claim a missing publication) happens upstream: in the
 * pinned `getSiteStandardRecordsFromRefs`
 * (`hydration/external.ts`), or by `validateStandardSiteRecordsForUrl` over
 * `getStandardSiteRecordsForUri`'s selection (which alone leaves an orphan
 * document selected with an absent publication). By the time this
 * function runs the pair is already known to be structurally consistent,
 * so we only check whether the records back the URL.
 *
 * For document validation, `SUBPATH_FRIENDLY_DOMAINS` (and their
 * subdomains) accept an assumed URL whose path extends the canonical
 * record URL with additional segments — these are platforms where each
 * record's author owns the full subpath space under their claimed URL.
 * Publication-only validation always requires exact match: there's no
 * coherent "subpath" of a publication's home page.
 *
 * Cases:
 * - Document + publication: `publication.url + document.path` must
 *   canonicalize to `assumedUrl` (or be a subpath-friendly prefix of it).
 * - Loose document (web-URL `site`): `document.site + document.path`
 *   must canonicalize to `assumedUrl` (or be a subpath-friendly prefix).
 *   (Doc with at-uri `site` but no publication can't reach this function
 *   — callers reject it.)
 * - Publication only: `publication.url` must canonicalize exactly to
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
    { ref: { uri: string }; info: { record: { url: string } } } | undefined,
  assumedUrl: string,
): boolean => {
  const canonicalAssumed = canonicalizeHttpUrl(assumedUrl)
  if (canonicalAssumed === null) return false

  if (document && publication) {
    const joined = canonicalizeHttpUrl(
      joinPath(publication.info.record.url, document.info.record.path ?? ''),
    )
    return (
      joined !== null && canonicalUrlMatchesAssumed(joined, canonicalAssumed)
    )
  }
  if (document) {
    const joined = canonicalizeHttpUrl(
      joinPath(document.info.record.site, document.info.record.path ?? ''),
    )
    return (
      joined !== null && canonicalUrlMatchesAssumed(joined, canonicalAssumed)
    )
  }
  if (publication) {
    // Publication-only matches are exact: `assumedUrl` represents the
    // publication's home page, not an article underneath it. Subpath
    // extensions belong to document validation.
    return canonicalizeHttpUrl(publication.info.record.url) === canonicalAssumed
  }
  return true
}

export type StandardSiteRecordSelection = {
  document?: AssociatedSiteStandardRecord<SiteStandardDocument>
  publication?: AssociatedSiteStandardRecord<SiteStandardPublication>
}

const matchStoredRecord = <TSchema extends RecordSchema>(
  schema: TSchema,
  uri: AtUriString,
  info: ExternalRecord | null | undefined,
): AssociatedSiteStandardRecord<RecordInfo<InferInput<TSchema>>> | undefined =>
  info && schema.$matches(info.record, { strict: false })
    ? { ref: { uri, cid: info.cid }, info: { ...info, record: info.record } }
    : undefined

/**
 * Select the Standard.site records backing `canonicalUri` from in-memory
 * hydrated `records`: the canonical record itself and, for a document whose
 * `site` is a publication AT-URI, that publication. Stored bodies are checked
 * against the Lexicon without parsing or defaulting. Nothing is fetched, and a
 * missing or invalid referenced publication leaves that slot empty while the
 * document stays selected.
 */
export const getStandardSiteRecordsForUri = (
  canonicalUri: AtUriString,
  records: ExternalRecords | undefined,
): StandardSiteRecordSelection => {
  const parsed = parseAtUriString(canonicalUri)
  if (!parsed.success) return {}
  const info = records?.get(canonicalUri)

  switch (parsed.value.collection) {
    case site.standard.publication.$type: {
      const publication = matchStoredRecord(
        site.standard.publication.main,
        canonicalUri,
        info,
      )
      return publication ? { publication } : {}
    }
    case site.standard.document.$type: {
      const document = matchStoredRecord(
        site.standard.document.main,
        canonicalUri,
        info,
      )
      if (!document) return {}
      const publicationUri = publicationUriOf(document.info.record.site)
      if (!publicationUri) return { document }
      const publication = matchStoredRecord(
        site.standard.publication.main,
        publicationUri,
        records?.get(publicationUri),
      )
      return publication ? { document, publication } : { document }
    }
    default:
      return {}
  }
}

const publicationUriOf = (value: string): AtUriString | undefined => {
  const parsed = parseAtUriString(value)
  return parsed.success &&
    parsed.value.collection === site.standard.publication.$type
    ? (value as AtUriString)
    : undefined
}

/**
 * Whether the selected records form a valid association that backs
 * `assumedUrl`. A document naming a publication AT-URI needs exactly that
 * publication; a supplied publication must be the one the document names.
 * Standalone publications and documents with a web-URL `site` are valid on
 * their own. URL comparison is `validateStandardSiteForUrl`; renderability
 * (e.g. empty titles) is not considered.
 */
export const validateStandardSiteRecordsForUrl = (
  document: AssociatedSiteStandardRecord<SiteStandardDocument> | undefined,
  publication:
    AssociatedSiteStandardRecord<SiteStandardPublication> | undefined,
  assumedUrl: string,
): boolean => {
  if (!document && !publication) return false
  if (document) {
    const documentSite = document.info.record.site
    if (publication) {
      if (documentSite !== publication.ref.uri) return false
    } else if (publicationUriOf(documentSite)) {
      return false
    }
  }
  return validateStandardSiteForUrl(document, publication, assumedUrl)
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
