/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'

const id = 'app.bsky.feed.threadgate'

export interface Record {
  /** Reference (AT-URI) to the post record. */
  post: string
  allow?: (
    | MentionRule
    | FollowingRule
    | ListRule
    | { $type: string; [k: string]: unknown }
  )[]
  createdAt: string
  /** List of hidden reply URIs. */
  hiddenReplies?: string[]
  [k: string]: unknown
}

export function isRecord(
  v: unknown,
): v is Record & { $type: $Type<'app.bsky.feed.threadgate', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

/** Allow replies from actors mentioned in your post. */
export interface MentionRule {
  [k: string]: unknown
}

export function isMentionRule(v: unknown): v is MentionRule & {
  $type: $Type<'app.bsky.feed.threadgate', 'mentionRule'>
} {
  return is$typed(v, id, 'mentionRule')
}

export function validateMentionRule(v: unknown) {
  return lexicons.validate(
    `${id}#mentionRule`,
    v,
  ) as ValidationResult<MentionRule>
}

/** Allow replies from actors you follow. */
export interface FollowingRule {
  [k: string]: unknown
}

export function isFollowingRule(v: unknown): v is FollowingRule & {
  $type: $Type<'app.bsky.feed.threadgate', 'followingRule'>
} {
  return is$typed(v, id, 'followingRule')
}

export function validateFollowingRule(v: unknown) {
  return lexicons.validate(
    `${id}#followingRule`,
    v,
  ) as ValidationResult<FollowingRule>
}

/** Allow replies from actors on a list. */
export interface ListRule {
  list: string
  [k: string]: unknown
}

export function isListRule(
  v: unknown,
): v is ListRule & { $type: $Type<'app.bsky.feed.threadgate', 'listRule'> } {
  return is$typed(v, id, 'listRule')
}

export function validateListRule(v: unknown) {
  return lexicons.validate(`${id}#listRule`, v) as ValidationResult<ListRule>
}
