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
const id = 'app.bsky.feed.threadgate'

export interface Record {
  $type: 'app.bsky.feed.threadgate'
  /** Reference (AT-URI) to the post record. */
  post: string
  /** List of rules defining who can reply to this post. If value is an empty array, no one can reply. If value is undefined, anyone can reply. */
  allow?: (
    | $Typed<MentionRule>
    | $Typed<FollowerRule>
    | $Typed<FollowingRule>
    | $Typed<ListRule>
    | { $type: string }
  )[]
  createdAt: string
  /** List of hidden reply URIs. */
  hiddenReplies?: string[]
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

/** Allow replies from actors mentioned in your post. */
export interface MentionRule {
  $type?: 'app.bsky.feed.threadgate#mentionRule'
}

const hashMentionRule = 'mentionRule'

export function isMentionRule<V>(v: V) {
  return is$typed(v, id, hashMentionRule)
}

export function validateMentionRule<V>(v: V) {
  return validate<MentionRule & V>(v, id, hashMentionRule)
}

/** Allow replies from actors who follow you. */
export interface FollowerRule {
  $type?: 'app.bsky.feed.threadgate#followerRule'
}

const hashFollowerRule = 'followerRule'

export function isFollowerRule<V>(v: V) {
  return is$typed(v, id, hashFollowerRule)
}

export function validateFollowerRule<V>(v: V) {
  return validate<FollowerRule & V>(v, id, hashFollowerRule)
}

/** Allow replies from actors you follow. */
export interface FollowingRule {
  $type?: 'app.bsky.feed.threadgate#followingRule'
}

const hashFollowingRule = 'followingRule'

export function isFollowingRule<V>(v: V) {
  return is$typed(v, id, hashFollowingRule)
}

export function validateFollowingRule<V>(v: V) {
  return validate<FollowingRule & V>(v, id, hashFollowingRule)
}

/** Allow replies from actors on a list. */
export interface ListRule {
  $type?: 'app.bsky.feed.threadgate#listRule'
  list: string
}

const hashListRule = 'listRule'

export function isListRule<V>(v: V) {
  return is$typed(v, id, hashListRule)
}

export function validateListRule<V>(v: V) {
  return validate<ListRule & V>(v, id, hashListRule)
}
