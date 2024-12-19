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
const id = 'app.bsky.feed.threadgate'

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

/** Allow replies from actors mentioned in your post. */
export interface MentionRule {
  $type?: $Type<'app.bsky.feed.threadgate', 'mentionRule'>
}

const hashMentionRule = 'mentionRule'

export function isMentionRule<V>(v: V) {
  return is$typed(v, id, hashMentionRule)
}

export function validateMentionRule<V>(v: V) {
  return validate<MentionRule & V>(v, id, hashMentionRule)
}

export function isValidMentionRule<V>(v: V) {
  return isValid<MentionRule>(v, id, hashMentionRule)
}

/** Allow replies from actors you follow. */
export interface FollowingRule {
  $type?: $Type<'app.bsky.feed.threadgate', 'followingRule'>
}

const hashFollowingRule = 'followingRule'

export function isFollowingRule<V>(v: V) {
  return is$typed(v, id, hashFollowingRule)
}

export function validateFollowingRule<V>(v: V) {
  return validate<FollowingRule & V>(v, id, hashFollowingRule)
}

export function isValidFollowingRule<V>(v: V) {
  return isValid<FollowingRule>(v, id, hashFollowingRule)
}

/** Allow replies from actors on a list. */
export interface ListRule {
  $type?: $Type<'app.bsky.feed.threadgate', 'listRule'>
  list: string
}

const hashListRule = 'listRule'

export function isListRule<V>(v: V) {
  return is$typed(v, id, hashListRule)
}

export function validateListRule<V>(v: V) {
  return validate<ListRule & V>(v, id, hashListRule)
}

export function isValidListRule<V>(v: V) {
  return isValid<ListRule>(v, id, hashListRule)
}
