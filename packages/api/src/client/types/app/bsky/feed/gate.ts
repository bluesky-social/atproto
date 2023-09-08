/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface Record {
  post: string
  allow?: (
    | MentionRule
    | FollowingRule
    | ListRule
    | { $type: string; [k: string]: unknown }
  )[]
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.gate#main' || v.$type === 'app.bsky.feed.gate')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.gate#main', v)
}

/** Allow replies from actors mentioned in your post. */
export interface MentionRule {}

export function isMentionRule(v: unknown): v is MentionRule {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.gate#mentionRule'
  )
}

export function validateMentionRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.gate#mentionRule', v)
}

/** Allow replies from actors you follow. */
export interface FollowingRule {}

export function isFollowingRule(v: unknown): v is FollowingRule {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.gate#followingRule'
  )
}

export function validateFollowingRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.gate#followingRule', v)
}

/** Allow replies from actors on a list. */
export interface ListRule {
  list: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isListRule(v: unknown): v is ListRule {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.gate#listRule'
  )
}

export function validateListRule(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.gate#listRule', v)
}
