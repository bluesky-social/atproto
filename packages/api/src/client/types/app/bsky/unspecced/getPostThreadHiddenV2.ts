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
const id = 'app.bsky.unspecced.getPostThreadHiddenV2'

export interface QueryParams {
  /** Reference (AT-URI) to post record. This is the anchor post. */
  anchor: string
}

export type InputSchema = undefined

export interface OutputSchema {
  /** A flat list of thread hidden items. The depth of each item is indicated by the depth property inside the item. */
  thread: ThreadHiddenItem[]
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

export function toKnownErr(e: any) {
  return e
}

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
