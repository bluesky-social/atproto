/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Record {
  createdAt: string
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of detached quote post URIs. */
  detachedQuotes?: string[]
  quotepostRules?: (DisableRule | { $type: string; [k: string]: unknown })[]
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

/** Disables quoteposts of this post. */
export interface DisableRule {
  [k: string]: unknown
}

export function isDisableRule(v: unknown): v is DisableRule {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.postgate#disableRule'
  )
}

export function validateDisableRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.postgate#disableRule', v)
}
