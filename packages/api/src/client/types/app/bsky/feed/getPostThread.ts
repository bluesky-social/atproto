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
import type * as AppBskyFeedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.getPostThread'

export interface QueryParams {
  /** Reference (AT-URI) to post record. */
  uri: string
  /** How many levels of reply depth should be included in response. */
  depth?: number
  /** How many levels of parent (and grandparent, etc) post to include. */
  parentHeight?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  thread:
    | $Typed<AppBskyFeedDefs.ThreadViewPost>
    | $Typed<AppBskyFeedDefs.NotFoundPost>
    | $Typed<AppBskyFeedDefs.BlockedPost>
    | { $type: string }
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
