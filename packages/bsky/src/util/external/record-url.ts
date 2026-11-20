import {
  type AtUriString,
  type UriString,
  isDidString,
} from '@atproto/lex-schema'
import { AtUri } from '@atproto/syntax'
import { type place, social } from '../../lexicons/index.js'

const RECORD_URL_BUILDERS: ReadonlyMap<string, (uri: AtUri) => UriString> =
  new Map([
    [
      social.grain.gallery.$type,
      ({ host, rkey }) =>
        `https://grain.social/profile/${host}/gallery/${rkey}` as UriString,
    ],
  ])

/**
 * Web URL for a record on the app that owns its collection, or `undefined`
 * when the collection has no builder or the URI is not a complete DID-based
 * record URI. Pure: handles are not resolved.
 */
export function buildExternalRecordUrl(
  uri: AtUriString,
): UriString | undefined {
  const parsed = new AtUri(uri)
  if (!isDidString(parsed.host) || !parsed.rkey) return
  return RECORD_URL_BUILDERS.get(parsed.collection)?.(parsed)
}

/** Prefer the viewer-facing canonical URL over the stream replication hint. */
export function getLivestreamUrl(
  record: Pick<place.stream.livestream.Main, 'canonicalUrl' | 'url'>,
): UriString | undefined {
  for (const value of [record.canonicalUrl, record.url]) {
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.href as UriString
      }
    } catch {
      continue
    }
  }
}
