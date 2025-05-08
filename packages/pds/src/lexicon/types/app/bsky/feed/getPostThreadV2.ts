/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import type * as AppBskyFeedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.getPostThreadV2'

export interface QueryParams {
  /** Reference (AT-URI) to post record. */
  uri: string
  /** How many levels of parent (and grandparent, etc) post to include. */
  above: number
  /** How many levels of reply depth to include. */
  below: number
  /** Maximum of replies to include at each level of the thread. */
  branchingFactor: number
  /** Whether to prioritize posts from followed users. */
  prioritizeFollowedUsers: boolean
  /** Sorting for the thread replies. */
  sorting:
    | 'app.bsky.feed.getPostThreadV2#newest'
    | 'app.bsky.feed.getPostThreadV2#oldest'
    | 'app.bsky.feed.getPostThreadV2#hotness'
    | 'app.bsky.feed.getPostThreadV2#mostLikes'
    | (string & {})
}

export type InputSchema = undefined

export interface OutputSchema {
  /** A flat list of thread items. The depth of each item is indicated by the depth property inside the item. */
  thread: (
    | $Typed<AppBskyFeedDefs.ThreadItemPost>
    | $Typed<AppBskyFeedDefs.ThreadItemNoUnauthenticated>
    | $Typed<AppBskyFeedDefs.ThreadItemNotFound>
    | $Typed<AppBskyFeedDefs.ThreadItemBlocked>
    | { $type: string }
  )[]
  threadgate?: AppBskyFeedDefs.ThreadgateView
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'NotFound'
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

/** Newest-first thread sort order. */
export const NEWEST = `${id}#newest`
/** Oldest-first thread sort order. */
export const OLDEST = `${id}#oldest`
/** Hottest-first thread sort order. */
export const HOTNESS = `${id}#hotness`
/** Most-likes-first thread sort order. */
export const MOSTLIKES = `${id}#mostLikes`
