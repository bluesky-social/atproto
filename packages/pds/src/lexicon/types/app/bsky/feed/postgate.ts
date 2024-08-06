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
  quotepostRules?: (
    | DisableRule
    | MentionRule
    | FollowingRule
    | ListRule
    | { $type: string; [k: string]: unknown }
  )[]
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

/** Disable quoteposts entirely. */
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

/** Allow quoteposts from actors mentioned in your post. */
export interface MentionRule {
  [k: string]: unknown
}

export function isMentionRule(v: unknown): v is MentionRule {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.postgate#mentionRule'
  )
}

export function validateMentionRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.postgate#mentionRule', v)
}

/** Allow quoteposts from actors you follow. */
export interface FollowingRule {
  [k: string]: unknown
}

export function isFollowingRule(v: unknown): v is FollowingRule {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.postgate#followingRule'
  )
}

export function validateFollowingRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.postgate#followingRule', v)
}

/** Allow quoteposts from actors on a list. */
export interface ListRule {
  list: string
  [k: string]: unknown
}

export function isListRule(v: unknown): v is ListRule {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.postgate#listRule'
  )
}

export function validateListRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.postgate#listRule', v)
}
