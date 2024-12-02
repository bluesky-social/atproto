/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'app.bsky.feed.threadgate'

export interface Record {
  $type?: $Type<'app.bsky.feed.threadgate', 'main'>
  /** Reference (AT-URI) to the post record. */
  post: string
  allow?: (
    | $Typed<MentionRule>
    | $Typed<FollowingRule>
    | $Typed<ListRule>
    | { $type: string }
  )[]
  createdAt: string
  /** List of hidden reply URIs. */
  hiddenReplies?: string[]
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

/** Allow replies from actors mentioned in your post. */
export interface MentionRule {
  $type?: $Type<'app.bsky.feed.threadgate', 'mentionRule'>
}

export function isMentionRule<V>(v: V) {
  return is$typed(v, id, 'mentionRule')
}

export function validateMentionRule(v: unknown) {
  return lexicons.validate(
    `${id}#mentionRule`,
    v,
  ) as ValidationResult<MentionRule>
}

export function isValidMentionRule<V>(v: V): v is V & $Typed<MentionRule> {
  return isMentionRule(v) && validateMentionRule(v).success
}

/** Allow replies from actors you follow. */
export interface FollowingRule {
  $type?: $Type<'app.bsky.feed.threadgate', 'followingRule'>
}

export function isFollowingRule<V>(v: V) {
  return is$typed(v, id, 'followingRule')
}

export function validateFollowingRule(v: unknown) {
  return lexicons.validate(
    `${id}#followingRule`,
    v,
  ) as ValidationResult<FollowingRule>
}

export function isValidFollowingRule<V>(v: V): v is V & $Typed<FollowingRule> {
  return isFollowingRule(v) && validateFollowingRule(v).success
}

/** Allow replies from actors on a list. */
export interface ListRule {
  $type?: $Type<'app.bsky.feed.threadgate', 'listRule'>
  list: string
}

export function isListRule<V>(v: V) {
  return is$typed(v, id, 'listRule')
}

export function validateListRule(v: unknown) {
  return lexicons.validate(`${id}#listRule`, v) as ValidationResult<ListRule>
}

export function isValidListRule<V>(v: V): v is V & $Typed<ListRule> {
  return isListRule(v) && validateListRule(v).success
}
