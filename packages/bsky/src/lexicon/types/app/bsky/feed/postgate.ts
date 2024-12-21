/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'

const id = 'app.bsky.feed.postgate'

export interface Record {
  createdAt: string
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of AT-URIs embedding this post that the author has detached from. */
  detachedEmbeddingUris?: string[]
  embeddingRules?: (DisableRule | { $type: string; [k: string]: unknown })[]
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'app.bsky.feed.postgate', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

/** Disables embedding of this post. */
export interface DisableRule {
  [k: string]: unknown
}

export function isDisableRule(v: unknown): v is DisableRule & {
  $type: $Type<'app.bsky.feed.postgate', 'disableRule'>
} {
  return is$typed(v, id, 'disableRule')
}

export function validateDisableRule(v: unknown) {
  return lexicons.validate(
    `${id}#disableRule`,
    v,
  ) as ValidationResult<DisableRule>
}
