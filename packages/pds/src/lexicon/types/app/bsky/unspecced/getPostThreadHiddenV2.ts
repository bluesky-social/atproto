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
const id = 'app.bsky.unspecced.getPostThreadHiddenV2'

export interface QueryParams {
  /** Reference (AT-URI) to post record. This is the anchor post. */
  anchor: string
  /** Whether to prioritize posts from followed users. It only has effect when the user is authenticated. */
  prioritizeFollowedUsers: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  /** A flat list of thread hidden items. The depth of each item is indicated by the depth property inside the item. */
  thread: ThreadHiddenItem[]
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

export interface ThreadHiddenItem {
  $type?: 'app.bsky.unspecced.getPostThreadHiddenV2#threadHiddenItem'
  uri: string
  /** The nesting level of this item in the thread. Depth 0 means the anchor item. Items above have negative depths, items below have positive depths. */
  depth: number
  value: $Typed<ThreadHiddenItemPost> | { $type: string }
}

const hashThreadHiddenItem = 'threadHiddenItem'

export function isThreadHiddenItem<V>(v: V) {
  return is$typed(v, id, hashThreadHiddenItem)
}

export function validateThreadHiddenItem<V>(v: V) {
  return validate<ThreadHiddenItem & V>(v, id, hashThreadHiddenItem)
}

export interface ThreadHiddenItemPost {
  $type?: 'app.bsky.unspecced.getPostThreadHiddenV2#threadHiddenItemPost'
  post: AppBskyFeedDefs.PostView
  /** The threadgate created by the author indicates this post as a reply to be hidden for everyone consuming the thread. */
  hiddenByThreadgate: boolean
  /** This is by an account muted by the viewer requesting it. */
  mutedByViewer: boolean
}

const hashThreadHiddenItemPost = 'threadHiddenItemPost'

export function isThreadHiddenItemPost<V>(v: V) {
  return is$typed(v, id, hashThreadHiddenItemPost)
}

export function validateThreadHiddenItemPost<V>(v: V) {
  return validate<ThreadHiddenItemPost & V>(v, id, hashThreadHiddenItemPost)
}
