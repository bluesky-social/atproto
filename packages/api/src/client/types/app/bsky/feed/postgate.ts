/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface Record {
  createdAt: string
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of detached quote post URIs. */
  detachedQuotes?: string[]
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.postgate#main' ||
      v.$type === 'app.bsky.feed.postgate')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.postgate#main', v)
}
