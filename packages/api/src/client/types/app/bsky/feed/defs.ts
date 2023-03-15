/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedExternal from '../embed/external'
import * as AppBskyEmbedRecord from '../embed/record'

export interface PostView {
  uri: string
  cid: string
  author: AppBskyActorDefs.WithInfo
  record: {}
  embed?:
    | AppBskyEmbedImages.Presented
    | AppBskyEmbedExternal.Presented
    | AppBskyEmbedRecord.Presented
    | { $type: string; [k: string]: unknown }
  replyCount: number
  repostCount: number
  upvoteCount: number
  downvoteCount: number
  indexedAt: string
  viewer: ViewerState
  [k: string]: unknown
}

export function isPostView(v: unknown): v is PostView {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.defs#postView'
  )
}

export function validatePostView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#postView', v)
}

export interface ViewerState {
  repost?: string
  upvote?: string
  downvote?: string
  [k: string]: unknown
}

export function isViewerState(v: unknown): v is ViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#viewerState'
  )
}

export function validateViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#viewerState', v)
}

export interface PostViewInFeed {
  post: PostView
  reply?: ReplyRef
  reason?: ReasonRepost | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isPostViewInFeed(v: unknown): v is PostViewInFeed {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#postViewInFeed'
  )
}

export function validatePostViewInFeed(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#postViewInFeed', v)
}

export interface ReplyRef {
  root: PostView
  parent: PostView
  [k: string]: unknown
}

export function isReplyRef(v: unknown): v is ReplyRef {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.defs#replyRef'
  )
}

export function validateReplyRef(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#replyRef', v)
}

export interface ReasonRepost {
  by: AppBskyActorDefs.WithInfo
  indexedAt: string
  [k: string]: unknown
}

export function isReasonRepost(v: unknown): v is ReasonRepost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#reasonRepost'
  )
}

export function validateReasonRepost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#reasonRepost', v)
}
