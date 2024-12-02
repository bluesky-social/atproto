/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyRichtextFacet from '../richtext/facet'

export const id = 'app.bsky.graph.starterpack'

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

export function isRecord<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

export function isValidRecord<V>(v: V): v is V & $Typed<Record> {
  return isRecord(v) && validateRecord(v).success
}

export interface FeedItem {
  $type?: $Type<'app.bsky.graph.starterpack', 'feedItem'>
  uri: string
}

export function isFeedItem<V>(v: V) {
  return is$typed(v, id, 'feedItem')
}

export function validateFeedItem(v: unknown) {
  return lexicons.validate(`${id}#feedItem`, v) as ValidationResult<FeedItem>
}

export function isValidFeedItem<V>(v: V): v is V & $Typed<FeedItem> {
  return isFeedItem(v) && validateFeedItem(v).success
}
