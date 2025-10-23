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

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.postgate'

export interface Main {
  $type: 'app.bsky.feed.postgate'
  createdAt: string
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of AT-URIs embedding this post that the author has detached from. */
  detachedEmbeddingUris?: string[]
  /** List of rules defining who can embed this post. If value is an empty array or is undefined, no particular rules apply and anyone can embed. */
  embeddingRules?: ($Typed<DisableRule> | { $type: string })[]
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}

/** Disables embedding of this post. */
export interface DisableRule {
  $type?: 'app.bsky.feed.postgate#disableRule'
}

const hashDisableRule = 'disableRule'

export function isDisableRule<V>(v: V) {
  return is$typed(v, id, hashDisableRule)
}

export function validateDisableRule<V>(v: V) {
  return validate<DisableRule & V>(v, id, hashDisableRule)
}
