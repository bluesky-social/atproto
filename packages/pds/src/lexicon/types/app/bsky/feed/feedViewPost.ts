/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as AppBskyActorPost from '../actor/post'
import * as AppBskyActorRef from '../actor/ref'

export interface Main {
  post: AppBskyActorPost.View
  reply?: ReplyRef
  reason?: ReasonTrend | ReasonRepost | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface ReplyRef {
  root: AppBskyActorPost.View
  parent: AppBskyActorPost.View
  [k: string]: unknown
}

export interface ReasonTrend {
  by: AppBskyActorRef.WithInfo
  indexedAt: string
  [k: string]: unknown
}

export interface ReasonRepost {
  by: AppBskyActorRef.WithInfo
  indexedAt: string
  [k: string]: unknown
}
