/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'app.bsky.feed.generator'

export interface Record {
  $type?: $Type<'app.bsky.feed.generator', 'main'>
  did: string
  displayName: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: BlobRef
  /** Declaration that a feed accepts feedback interactions from a client through app.bsky.feed.sendInteractions */
  acceptsInteractions?: boolean
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  createdAt: string
  [k: string]: unknown
}

export function isRecord<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

export function isValidRecord<V>(v: V): v is V & $Typed<Record> {
  return isRecord(v) && validateRecord(v).success
}
