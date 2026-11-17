import { parseAtUriString } from '@atproto/syntax'
import {
  genericRecordKey,
  getSiteStandardRecordsFromRefs,
} from '../../hydration/external.js'
import type { HydrationState } from '../../hydration/hydrator.js'
import type { ItemRef } from '../../hydration/util.js'
import { place, site, social } from '../../lexicons/index.js'
import { isExternalRecordUrlSafe } from './index.js'
import {
  getStandardSiteRecordsForUri,
  validateStandardSiteRecordsForUrl,
} from './standard-site.js'
import { validateLivestreamForUrl } from './streamplace.js'

/**
 * Check a hydrated record's association with an external embed's claimed URL:
 * the post's `external.uri` or compose request's `url`, never a URL derived
 * from the record being checked. Standalone modality views need no such check
 * at the moment, since we implicitly trust certain records and their hosts.
 *
 * Pinned roots resolve exactly, with no fallback to latest or discarded authored
 * refs. Referenced publications resolve as latest dependencies.
 *
 * Non-Standard.site URLs must also pass the configured domain allowlist.
 * No I/O or rendering; URL trust is independent of display-field usability.
 * Hydration and view builders still enforce moderation, so passing is not
 * sufficient to render.
 */
export function validateExternalEmbedRecord({
  ref,
  url,
  state,
  safeDomains = [],
}: {
  ref: ItemRef
  url: string
  state: Pick<HydrationState, 'externalRecords' | 'externalRecordsByRef'>
  safeDomains?: readonly string[]
}): boolean {
  const parsed = parseAtUriString(ref.uri)
  if (!parsed.success) return false
  const { uri, cid } = ref
  const root =
    cid === undefined
      ? state.externalRecords?.get(uri)
      : state.externalRecordsByRef?.get(genericRecordKey({ uri, cid }))
  if (!root || root.record.$type !== parsed.value.collection) return false

  switch (parsed.value.collection) {
    case site.standard.document.$type:
    case site.standard.publication.$type: {
      const { document, publication } =
        cid === undefined
          ? getStandardSiteRecordsForUri(uri, state.externalRecords)
          : getSiteStandardRecordsFromRefs(
              [{ uri, cid }],
              state.externalRecordsByRef,
              state.externalRecords,
            )
      return validateStandardSiteRecordsForUrl(document, publication, url)
    }
    case social.grain.gallery.$type:
      return (
        isExternalRecordUrlSafe(url, safeDomains) &&
        isExternalRecordUrlSafe(url, ['grain.social'])
      )
    case place.stream.livestream.$type:
      if (!isExternalRecordUrlSafe(url, safeDomains)) return false
      if (!place.stream.livestream.$matches(root.record)) return false
      return validateLivestreamForUrl(root.record, url)
    default:
      return isExternalRecordUrlSafe(url, safeDomains)
  }
}
