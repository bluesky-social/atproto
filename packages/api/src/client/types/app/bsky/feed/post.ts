/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedExternal from '../embed/external'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'
import * as AppBskyActorRef from '../actor/ref'

export interface Record {
  text: string
  entities?: Entity[]
  reply?: ReplyRef
  embed?:
    | AppBskyEmbedImages.Main
    | AppBskyEmbedExternal.Main
    | { $type: string; [k: string]: unknown }
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.post#main' || v.$type === 'app.bsky.feed.post')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#main', v)
}

export interface ReplyRef {
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isReplyRef(v: unknown): v is ReplyRef {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.post#replyRef'
  )
}

export function validateReplyRef(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#replyRef', v)
}

export interface Entity {
  index: TextSlice
  /** Expected values are 'mention', 'hashtag', and 'link'. */
  type: string
  value: string
  [k: string]: unknown
}

export function isEntity(v: unknown): v is Entity {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.post#entity'
  )
}

export function validateEntity(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#entity', v)
}

/** A text segment. Start is inclusive, end is exclusive. */
export interface TextSlice {
  start: number
  end: number
  [k: string]: unknown
}

export function isTextSlice(v: unknown): v is TextSlice {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.post#textSlice'
  )
}

export function validateTextSlice(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#textSlice', v)
}

export interface View {
  uri: string
  cid: string
  author: AppBskyActorRef.WithInfo
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
  viewer: ViewerState
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.post#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#view', v)
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
    v.$type === 'app.bsky.feed.post#viewerState'
  )
}

export function validateViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#viewerState', v)
}
