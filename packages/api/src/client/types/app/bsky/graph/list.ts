/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyGraphDefs from './defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'

export const id = 'app.bsky.graph.list'

export interface Record {
  $type?: $Type<'app.bsky.graph.list', 'main'>
  purpose: AppBskyGraphDefs.ListPurpose
  /** Display name for list; can not be empty. */
  name: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: BlobRef
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
