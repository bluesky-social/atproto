/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyFeedDefs from '../feed/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.unspecced.getPostThreadV2'

export interface QueryParams {
  /** Reference (AT-URI) to post record. */
  uri: string
  /** How many levels of parent (and grandparent, etc) post to include. */
  above?: number
  /** How many levels of reply depth to include. */
  below?: number
  /** Maximum of replies to include at each level of the thread, except for the direct replies to the anchor, which are all returned. */
  nestedBranchingFactor?: number
  /** Whether to prioritize posts from followed users. */
  prioritizeFollowedUsers?: boolean
  /** Sorting for the thread replies. */
  sorting?:
    | 'app.bsky.unspecced.getPostThreadV2#newest'
    | 'app.bsky.unspecced.getPostThreadV2#oldest'
    | 'app.bsky.unspecced.getPostThreadV2#hotness'
    | 'app.bsky.unspecced.getPostThreadV2#mostLikes'
    | (string & {})
}

export type InputSchema = undefined

export interface OutputSchema {
  /** A flat list of thread items. The depth of each item is indicated by the depth property inside the item. */
  thread: ThreadItem[]
  threadgate?: AppBskyFeedDefs.ThreadgateView
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class NotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'NotFound') return new NotFoundError(e)
  }

  return e
}

/** Newest-first thread sort order. */
export const NEWEST = `${id}#newest`
/** Oldest-first thread sort order. */
export const OLDEST = `${id}#oldest`
/** Hottest-first thread sort order. */
export const HOTNESS = `${id}#hotness`
/** Most-likes-first thread sort order. */
export const MOSTLIKES = `${id}#mostLikes`

export interface ThreadItem {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadItem'
  uri: string
  /** The nesting level of this item in the thread. Depth 0 means the anchor item. Items above have negative depths, items below have positive depths. */
  depth: number
  value:
    | $Typed<ThreadItemPost>
    | $Typed<ThreadItemNoUnauthenticated>
    | $Typed<ThreadItemNotFound>
    | $Typed<ThreadItemBlocked>
    | { $type: string }
}

const hashThreadItem = 'threadItem'

export function isThreadItem<V>(v: V) {
  return is$typed(v, id, hashThreadItem)
}

export function validateThreadItem<V>(v: V) {
  return validate<ThreadItem & V>(v, id, hashThreadItem)
}

export interface ThreadItemPost {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadItemPost'
  post: AppBskyFeedDefs.PostView
  /** Whether this post is part of a contiguous chain of OP replies. */
  isOPThread: boolean
  /** Whether this post has a like from the OP. */
  hasOPLike: boolean
  /** Whether this post has replies. Note the replies may not be included in the thread if they are too deep. */
  hasReplies: boolean
}

const hashThreadItemPost = 'threadItemPost'

export function isThreadItemPost<V>(v: V) {
  return is$typed(v, id, hashThreadItemPost)
}

export function validateThreadItemPost<V>(v: V) {
  return validate<ThreadItemPost & V>(v, id, hashThreadItemPost)
}

export interface ThreadItemNoUnauthenticated {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadItemNoUnauthenticated'
}

const hashThreadItemNoUnauthenticated = 'threadItemNoUnauthenticated'

export function isThreadItemNoUnauthenticated<V>(v: V) {
  return is$typed(v, id, hashThreadItemNoUnauthenticated)
}

export function validateThreadItemNoUnauthenticated<V>(v: V) {
  return validate<ThreadItemNoUnauthenticated & V>(
    v,
    id,
    hashThreadItemNoUnauthenticated,
  )
}

export interface ThreadItemNotFound {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadItemNotFound'
}

const hashThreadItemNotFound = 'threadItemNotFound'

export function isThreadItemNotFound<V>(v: V) {
  return is$typed(v, id, hashThreadItemNotFound)
}

export function validateThreadItemNotFound<V>(v: V) {
  return validate<ThreadItemNotFound & V>(v, id, hashThreadItemNotFound)
}

export interface ThreadItemBlocked {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadItemBlocked'
  author: AppBskyFeedDefs.BlockedAuthor
}

const hashThreadItemBlocked = 'threadItemBlocked'

export function isThreadItemBlocked<V>(v: V) {
  return is$typed(v, id, hashThreadItemBlocked)
}

export function validateThreadItemBlocked<V>(v: V) {
  return validate<ThreadItemBlocked & V>(v, id, hashThreadItemBlocked)
}
