/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyGraphDefs from './defs.js'
import type * as AppBskyRichtextFacet from '../richtext/facet.js'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.graph.list'

export interface Record {
  $type: 'app.bsky.graph.list'
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

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
