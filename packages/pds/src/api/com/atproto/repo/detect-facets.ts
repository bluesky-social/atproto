import type { IdResolver } from '@atproto/identity'

/**
 * Server-side facet detection for `app.bsky.feed.post` records.
 *
 * @NOTE This is OPT-IN (PDS_ENRICH_POST_FACETS) and diverges from atproto's
 * design, in which facet detection is a client responsibility and the PDS stores
 * records verbatim. It exists so a client that only sends `{ text, createdAt }`
 * still gets clickable #hashtags, links, and @mentions. Prefer detecting facets
 * on the client (see @atproto/api's RichText) whenever possible.
 *
 * The regexes and logic are copied from the client
 * (packages/api/src/rich-text/{util,detection}.ts) so the server produces
 * byte-identical facets. Facet indices are UTF-8 byte offsets, per the
 * app.bsky.richtext.facet lexicon.
 */

const encoder = new TextEncoder()

// utf16 (JS string) index -> utf8 byte index
const utf8Len = (s: string): number => encoder.encode(s).byteLength
const toByte = (text: string, utf16Index: number): number =>
  utf8Len(text.slice(0, utf16Index))

const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g
const URL_REGEX =
  /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim
const TRAILING_PUNCTUATION_REGEX = /\p{P}+$/gu
// The sigil (ascii `#` + fullwidth U+FF03) is NON-capturing, so match[2] is the
// tag text. \ufe0f = emoji modifier; the rest are zero-width codepoints.
// Zero-width/joiner codepoints in the class trip no-misleading-character-class;
// they are intentional (matching the client), hence the disable below.
const TAG_REGEX =
  // eslint-disable-next-line no-misleading-character-class
  /(^|\s)[#\uff03]((?!\ufe0f)[^\s\u00ad\u2060\u200a\u200b\u200c\u200d\u20e2]*[^\d\s\p{P}\u00ad\u2060\u200a\u200b\u200c\u200d\u20e2]+[^\s\u00ad\u2060\u200a\u200b\u200c\u200d\u20e2]*)?/gu

type Facet = {
  $type?: string
  index: { byteStart: number; byteEnd: number }
  features: Array<Record<string, unknown>>
}

const isValidTld = (str: string): boolean => {
  // Lightweight validity check: a dotted host whose final label is 2+ letters.
  // (The client validates against the full `tlds` list; we keep the PDS
  // dependency-free and accept the small precision tradeoff.)
  return /\.[a-z]{2,}$/i.test(str)
}

/**
 * Detect link and hashtag facets from post text. Mentions are detected and
 * returned with the *handle* in `did`; the caller must resolve them to DIDs.
 *
 * @NOTE synchronous by design: the module-level `g`-flag regexes have their
 * `lastIndex` reset here, which is only safe with no interleaving await.
 */
export function detectFacetsFromText(text: string): Facet[] {
  const facets: Facet[] = []
  let match: RegExpExecArray | null

  // mentions (unresolved: `did` holds the handle for the caller to resolve)
  MENTION_REGEX.lastIndex = 0
  while ((match = MENTION_REGEX.exec(text))) {
    const handle = match[3]
    if (!isValidTld(handle) && !handle.endsWith('.test')) continue
    const start = text.indexOf(handle, match.index) - 1 // include the '@'
    facets.push({
      $type: 'app.bsky.richtext.facet',
      index: {
        byteStart: toByte(text, start),
        byteEnd: toByte(text, start + handle.length + 1),
      },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: handle }],
    })
  }

  // links
  URL_REGEX.lastIndex = 0
  while ((match = URL_REGEX.exec(text))) {
    let uri = match[2]
    if (!uri.startsWith('http')) {
      const domain = match.groups?.domain
      if (!domain || !isValidTld(domain)) continue
      uri = `https://${uri}`
    }
    const start = text.indexOf(match[2], match.index)
    const index = { start, end: start + match[2].length }
    if (/[.,;:!?]$/.test(uri)) {
      uri = uri.slice(0, -1)
      index.end--
    }
    if (/[)]$/.test(uri) && !uri.includes('(')) {
      uri = uri.slice(0, -1)
      index.end--
    }
    facets.push({
      $type: 'app.bsky.richtext.facet',
      index: {
        byteStart: toByte(text, index.start),
        byteEnd: toByte(text, index.end),
      },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri }],
    })
  }

  // hashtags (match[2] is the tag text; sigil is non-capturing)
  TAG_REGEX.lastIndex = 0
  while ((match = TAG_REGEX.exec(text))) {
    const leading = match[1]
    let tag = match[2]
    if (!tag) continue
    tag = tag.trim().replace(TRAILING_PUNCTUATION_REGEX, '')
    // lexicon caps tags at maxGraphemes 64 / maxLength 640; a UTF-16 length
    // guard is a conservative superset (grapheme count <= utf16 length).
    if (tag.length === 0 || tag.length > 640) continue
    const index = match.index + leading.length
    facets.push({
      $type: 'app.bsky.richtext.facet',
      index: {
        byteStart: toByte(text, index),
        byteEnd: toByte(text, index + 1 + tag.length), // +1 for the sigil
      },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag }],
    })
  }

  return facets
}

/**
 * If `record` is an app.bsky.feed.post with text and no facets, populate its
 * facets in place (resolving mention handles to DIDs). Returns the (possibly
 * mutated) record. No-op for any other collection, or when facets already exist.
 */
export async function maybeEnrichPostFacets(
  collection: string,
  record: Record<string, unknown>,
  idResolver: IdResolver,
): Promise<Record<string, unknown>> {
  if (collection !== 'app.bsky.feed.post') return record
  if (typeof record.text !== 'string' || record.text.length === 0) return record
  if (Array.isArray(record.facets) && record.facets.length > 0) return record

  const facets = detectFacetsFromText(record.text)
  if (facets.length === 0) return record

  // Resolve mention handles -> DIDs; drop mentions that don't resolve.
  const resolved: Facet[] = []
  for (const facet of facets) {
    const feature = facet.features[0]
    if (feature?.$type === 'app.bsky.richtext.facet#mention') {
      const did = await idResolver.handle
        .resolve(feature.did as string)
        .catch(() => undefined)
      if (!did) continue // skip unresolvable mentions rather than write junk
      feature.did = did
    }
    resolved.push(facet)
  }
  if (resolved.length === 0) return record

  resolved.sort((a, b) => a.index.byteStart - b.index.byteStart)
  record.facets = resolved
  return record
}
