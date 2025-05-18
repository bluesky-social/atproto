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
  content:
    | $Typed<ThreadContentPost>
    | $Typed<ThreadContentNoUnauthenticated>
    | $Typed<ThreadContentNotFound>
    | $Typed<ThreadContentBlocked>
    | { $type: string }
}

const hashThreadItem = 'threadItem'

export function isThreadItem<V>(v: V) {
  return is$typed(v, id, hashThreadItem)
}

export function validateThreadItem<V>(v: V) {
  return validate<ThreadItem & V>(v, id, hashThreadItem)
}

export interface ThreadContentPost {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadContentPost'
  post: AppBskyFeedDefs.PostView
  /** Whether this post is part of a contiguous chain of OP replies. */
  isOPThread: boolean
  /** Whether this post has a like from the OP. */
  hasOPLike: boolean
  /** Whether this post has replies that have not been included in the response. */
  hasUnhydratedReplies: boolean
  /** Whether this post has parents that have not been included in the response. */
  hasUnhydratedParents: boolean
}

const hashThreadContentPost = 'threadContentPost'

export function isThreadContentPost<V>(v: V) {
  return is$typed(v, id, hashThreadContentPost)
}

export function validateThreadContentPost<V>(v: V) {
  return validate<ThreadContentPost & V>(v, id, hashThreadContentPost)
}

export interface ThreadContentNoUnauthenticated {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadContentNoUnauthenticated'
}

const hashThreadContentNoUnauthenticated = 'threadContentNoUnauthenticated'

export function isThreadContentNoUnauthenticated<V>(v: V) {
  return is$typed(v, id, hashThreadContentNoUnauthenticated)
}

export function validateThreadContentNoUnauthenticated<V>(v: V) {
  return validate<ThreadContentNoUnauthenticated & V>(
    v,
    id,
    hashThreadContentNoUnauthenticated,
  )
}

export interface ThreadContentNotFound {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadContentNotFound'
}

const hashThreadContentNotFound = 'threadContentNotFound'

export function isThreadContentNotFound<V>(v: V) {
  return is$typed(v, id, hashThreadContentNotFound)
}

export function validateThreadContentNotFound<V>(v: V) {
  return validate<ThreadContentNotFound & V>(v, id, hashThreadContentNotFound)
}

export interface ThreadContentBlocked {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadContentBlocked'
  author: AppBskyFeedDefs.BlockedAuthor
}

const hashThreadContentBlocked = 'threadContentBlocked'

export function isThreadContentBlocked<V>(v: V) {
  return is$typed(v, id, hashThreadContentBlocked)
}

export function validateThreadContentBlocked<V>(v: V) {
  return validate<ThreadContentBlocked & V>(v, id, hashThreadContentBlocked)
}
