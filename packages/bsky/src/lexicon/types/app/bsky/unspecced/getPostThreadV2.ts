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
import type * as AppBskyFeedDefs from '../feed/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.unspecced.getPostThreadV2'

export interface QueryParams {
  /** Reference (AT-URI) to post record. */
  uri: string
  /** How many levels of parent (and grandparent, etc) post to include. */
  above: number
  /** How many levels of reply depth to include. */
  below: number
  /** Maximum of replies to include at each level of the thread, except for the direct replies to the anchor, which are all returned. */
  nestedBranchingFactor: number
  /** Whether to prioritize posts from followed users. */
  prioritizeFollowedUsers: boolean
  /** Sorting for the thread replies. */
  sorting:
    | 'app.bsky.unspecced.getPostThreadV2#newest'
    | 'app.bsky.unspecced.getPostThreadV2#oldest'
    | 'app.bsky.unspecced.getPostThreadV2#top'
    | (string & {})
}

export type InputSchema = undefined

export interface OutputSchema {
  /** A flat list of thread items. The depth of each item is indicated by the depth property inside the item. */
  thread: ThreadItem[]
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

export const NEWEST = `${id}#newest`
export const OLDEST = `${id}#oldest`
export const TOP = `${id}#top`

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

export const HASREPLIES = `${id}#hasReplies`
export const HIDDENBYTHREADGATE = `${id}#hiddenByThreadgate`
export const MUTEDBYVIEWER = `${id}#mutedByViewer`
export const OPTHREAD = `${id}#opThread`

export interface ThreadItemPost {
  $type?: 'app.bsky.unspecced.getPostThreadV2#threadItemPost'
  post: AppBskyFeedDefs.PostView
  /** Annotations on this post that might be used by clients to customize experiences. */
  annotations:
    | 'app.bsky.unspecced.getPostThreadV2#hasReplies'
    | 'app.bsky.unspecced.getPostThreadV2#hiddenByThreadgate'
    | 'app.bsky.unspecced.getPostThreadV2#mutedByViewer'
    | 'app.bsky.unspecced.getPostThreadV2#opThread'
    | (string & {})[]
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
