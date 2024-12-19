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

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.feed.postgate'

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

/** Disables embedding of this post. */
export interface DisableRule {
  $type?: $Type<'app.bsky.feed.postgate', 'disableRule'>
}

const hashDisableRule = 'disableRule'

export function isDisableRule<V>(v: V) {
  return is$typed(v, id, hashDisableRule)
}

export function validateDisableRule<V>(v: V) {
  return validate<DisableRule & V>(v, id, hashDisableRule)
}

export function isValidDisableRule<V>(v: V) {
  return isValid<DisableRule>(v, id, hashDisableRule)
}
