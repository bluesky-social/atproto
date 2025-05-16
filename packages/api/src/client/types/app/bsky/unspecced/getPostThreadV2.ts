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
import type * as AppBskyUnspeccedDefs from './defs.js'
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
  branchingFactor?: number
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
  thread: (
    | $Typed<AppBskyUnspeccedDefs.ThreadItemPost>
    | $Typed<AppBskyUnspeccedDefs.ThreadItemNoUnauthenticated>
    | $Typed<AppBskyUnspeccedDefs.ThreadItemNotFound>
    | $Typed<AppBskyUnspeccedDefs.ThreadItemBlocked>
    | { $type: string }
  )[]
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
