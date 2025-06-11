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
import type * as AppBskyRichtextFacet from '../richtext/facet.js'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.generator'

export interface Record {
  $type: 'app.bsky.feed.generator'
  did: string
  displayName: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: BlobRef
  /** Declaration that a feed accepts feedback interactions from a client through app.bsky.feed.sendInteractions */
  acceptsInteractions?: boolean
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  contentMode?:
    | 'app.bsky.feed.defs#contentModeUnspecified'
    | 'app.bsky.feed.defs#contentModeVideo'
    | (string & {})
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
