/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedExternal from '../embed/external'
import * as AppBskyEmbedRecord from '../embed/record'
import * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia'

export interface PostView {
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  record: {}
  embed?:
    | AppBskyEmbedImages.View
    | AppBskyEmbedExternal.View
    | AppBskyEmbedRecord.View
    | AppBskyEmbedRecordWithMedia.View
    | { $type: string; [k: string]: unknown }
  replyCount?: number
  repostCount?: number
  likeCount?: number
  indexedAt: string
  viewer?: ViewerState
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
  like?: string
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

export interface FeedViewPost {
  post: PostView
  reply?: ReplyRef
  reason?: ReasonRepost | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isFeedViewPost(v: unknown): v is FeedViewPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#feedViewPost'
  )
}

export function validateFeedViewPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#feedViewPost', v)
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
  by: AppBskyActorDefs.ProfileViewBasic
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

export interface ThreadViewPost {
  post: PostView
  parent?:
    | ThreadViewPost
    | NotFoundPost
    | { $type: string; [k: string]: unknown }
  replies?: (
    | ThreadViewPost
    | NotFoundPost
    | { $type: string; [k: string]: unknown }
  )[]
  [k: string]: unknown
}

export function isThreadViewPost(v: unknown): v is ThreadViewPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#threadViewPost'
  )
}

export function validateThreadViewPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#threadViewPost', v)
}

export interface NotFoundPost {
  uri: string
  notFound: true
  [k: string]: unknown
}

export function isNotFoundPost(v: unknown): v is NotFoundPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#notFoundPost'
  )
}

export function validateNotFoundPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#notFoundPost', v)
}
