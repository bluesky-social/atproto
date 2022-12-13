/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as AppBskyActorRef from '../actor/ref'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedExternal from '../embed/external'

export interface QueryParams {
  author: string
  limit?: number
  before?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  feed: FeedItem[]
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}

export interface FeedItem {
  uri: string
  cid: string
  author: AppBskyActorRef.WithInfo
  trendedBy?: AppBskyActorRef.WithInfo
  repostedBy?: AppBskyActorRef.WithInfo
  record: {}
  embed?:
    | AppBskyEmbedImages.Presented
    | AppBskyEmbedExternal.Presented
    | { $type: string; [k: string]: unknown }
  replyCount: number
  repostCount: number
  upvoteCount: number
  downvoteCount: number
  indexedAt: string
  myState?: MyState
  [k: string]: unknown
}

export interface MyState {
  repost?: string
  upvote?: string
  downvote?: string
  [k: string]: unknown
}
