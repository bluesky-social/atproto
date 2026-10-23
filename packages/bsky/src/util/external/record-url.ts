import { type AtUriString, type UriString, isDidString } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { social } from '../../lexicons/index.js'

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
