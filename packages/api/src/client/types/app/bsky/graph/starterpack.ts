/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyRichtextFacet from '../richtext/facet'

const id = 'app.bsky.graph.starterpack'

export interface Record {
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

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'app.bsky.graph.starterpack', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

export interface FeedItem {
  uri: string
  [k: string]: unknown
}

export function isFeedItem(
  v: unknown,
): v is FeedItem & { $type: $Type<'app.bsky.graph.starterpack', 'feedItem'> } {
  return is$typed(v, id, 'feedItem')
}

export function validateFeedItem(v: unknown) {
  return lexicons.validate(`${id}#feedItem`, v) as ValidationResult<FeedItem>
}
