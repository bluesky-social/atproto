/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as AppBskyRichtextFacet from '../richtext/facet'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.graph.starterpack'

export interface Record {
  $type?: $Type<'app.bsky.graph.starterpack', 'main'>
  /** Display name for starter pack; can not be empty. */
  name: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  /** Reference (AT-URI) to the list record. */
  list: string
  feeds?: FeedItem[]
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord)
}

export function isValidRecord<V>(v: V) {
  return isValid<Record>(v, id, hashRecord, true)
}

export interface FeedItem {
  $type?: $Type<'app.bsky.graph.starterpack', 'feedItem'>
  uri: string
}

const hashFeedItem = 'feedItem'

export function isFeedItem<V>(v: V) {
  return is$typed(v, id, hashFeedItem)
}

export function validateFeedItem<V>(v: V) {
  return validate<FeedItem & V>(v, id, hashFeedItem)
}

export function isValidFeedItem<V>(v: V) {
  return isValid<FeedItem>(v, id, hashFeedItem)
}
