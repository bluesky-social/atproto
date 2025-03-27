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

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.graph.starterpack'

export interface Record {
  $type: 'app.bsky.graph.starterpack'
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
  return validate<Record & V>(v, id, hashRecord, true)
}

export interface FeedItem {
  $type?: 'app.bsky.graph.starterpack#feedItem'
  uri: string
}

const hashFeedItem = 'feedItem'

export function isFeedItem<V>(v: V) {
  return is$typed(v, id, hashFeedItem)
}

export function validateFeedItem<V>(v: V) {
  return validate<FeedItem & V>(v, id, hashFeedItem)
}
