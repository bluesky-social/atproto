/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'app.bsky.feed.postgate'

export interface Record {
  $type?: $Type<'app.bsky.feed.postgate', 'main'>
  createdAt: string
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of AT-URIs embedding this post that the author has detached from. */
  detachedEmbeddingUris?: string[]
  embeddingRules?: ($Typed<DisableRule> | { $type: string })[]
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

/** Disables embedding of this post. */
export interface DisableRule {
  $type?: $Type<'app.bsky.feed.postgate', 'disableRule'>
}

export function isDisableRule<V>(v: V) {
  return is$typed(v, id, 'disableRule')
}

export function validateDisableRule(v: unknown) {
  return lexicons.validate(
    `${id}#disableRule`,
    v,
  ) as ValidationResult<DisableRule>
}

export function isValidDisableRule<V>(v: V): v is V & $Typed<DisableRule> {
  return isDisableRule(v) && validateDisableRule(v).success
}
