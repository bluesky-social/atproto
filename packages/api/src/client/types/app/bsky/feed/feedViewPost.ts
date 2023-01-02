/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'
import * as AppBskyFeedPost from './post'
import * as AppBskyActorRef from '../actor/ref'

export interface Main {
  post: AppBskyFeedPost.View
  reply?: ReplyRef
  reason?: ReasonTrend | ReasonRepost | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.feedViewPost#main' ||
      v.$type === 'app.bsky.feed.feedViewPost')
  )
}

export interface ReplyRef {
  root: AppBskyFeedPost.View
  parent: AppBskyFeedPost.View
  [k: string]: unknown
}

export function isReplyRef(v: unknown): v is ReplyRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.feedViewPost#replyRef'
  )
}

export interface ReasonTrend {
  by: AppBskyActorRef.WithInfo
  indexedAt: string
  [k: string]: unknown
}

export function isReasonTrend(v: unknown): v is ReasonTrend {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.feedViewPost#reasonTrend'
  )
}

export interface ReasonRepost {
  by: AppBskyActorRef.WithInfo
  indexedAt: string
  [k: string]: unknown
}

export function isReasonRepost(v: unknown): v is ReasonRepost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.feedViewPost#reasonRepost'
  )
}
