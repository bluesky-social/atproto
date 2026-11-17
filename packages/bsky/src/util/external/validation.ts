import { parseAtUriString } from '@atproto/syntax'
import {
  genericRecordKey,
  getSiteStandardRecordsFromRefs,
} from '../../hydration/external.js'
import type { HydrationState } from '../../hydration/hydrator.js'
import type { ItemRef } from '../../hydration/util.js'
import { site } from '../../lexicons/index.js'
import {
  getStandardSiteRecordsForUri,
  validateStandardSiteRecordsForUrl,
} from './standard-site.js'

/**
 * Check a hydrated record's association with an external embed's claimed URL:
 * the post's `external.uri` or compose request's `url`, never a URL derived
 * from the record being checked. Standalone modality views need no such check
 * at the moment, since we implicitly trust certain records and their hosts.
 *
 * Pinned roots resolve exactly, with no fallback to latest or discarded authored
 * refs. Referenced publications resolve as latest dependencies.
 *
 * No I/O or rendering; URL trust is independent of display-field usability.
 * Hydration and view builders still enforce moderation, so passing is not
 * sufficient to render.
 */
export function validateExternalEmbedRecord({
  ref,
  url,
  state,
}: {
  ref: ItemRef
  url: string
  state: Pick<HydrationState, 'externalRecords' | 'externalRecordsByRef'>
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
    default:
      // @NOTE Other record types have no record-to-URL association rule yet.
      return true
  }
}
