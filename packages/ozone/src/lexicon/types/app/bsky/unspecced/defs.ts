/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyActorDefs from '../actor/defs.js'
import type * as AppBskyFeedDefs from '../feed/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.unspecced.defs'

export interface SkeletonSearchPost {
  $type?: 'app.bsky.unspecced.defs#skeletonSearchPost'
  uri: string
}

const hashSkeletonSearchPost = 'skeletonSearchPost'

export function isSkeletonSearchPost<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchPost)
}

export function validateSkeletonSearchPost<V>(v: V) {
  return validate<SkeletonSearchPost & V>(v, id, hashSkeletonSearchPost)
}

export interface SkeletonSearchActor {
  $type?: 'app.bsky.unspecced.defs#skeletonSearchActor'
  did: string
}

const hashSkeletonSearchActor = 'skeletonSearchActor'

export function isSkeletonSearchActor<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchActor)
}

export function validateSkeletonSearchActor<V>(v: V) {
  return validate<SkeletonSearchActor & V>(v, id, hashSkeletonSearchActor)
}

export interface SkeletonSearchStarterPack {
  $type?: 'app.bsky.unspecced.defs#skeletonSearchStarterPack'
  uri: string
}

const hashSkeletonSearchStarterPack = 'skeletonSearchStarterPack'

export function isSkeletonSearchStarterPack<V>(v: V) {
  return is$typed(v, id, hashSkeletonSearchStarterPack)
}

export function validateSkeletonSearchStarterPack<V>(v: V) {
  return validate<SkeletonSearchStarterPack & V>(
    v,
    id,
    hashSkeletonSearchStarterPack,
  )
}

export interface TrendingTopic {
  $type?: 'app.bsky.unspecced.defs#trendingTopic'
  topic: string
  displayName?: string
  description?: string
  link: string
}

const hashTrendingTopic = 'trendingTopic'

export function isTrendingTopic<V>(v: V) {
  return is$typed(v, id, hashTrendingTopic)
}

export function validateTrendingTopic<V>(v: V) {
  return validate<TrendingTopic & V>(v, id, hashTrendingTopic)
}

export interface SkeletonTrend {
  $type?: 'app.bsky.unspecced.defs#skeletonTrend'
  topic: string
  displayName: string
  link: string
  startedAt: string
  postCount: number
  status?: 'hot' | (string & {})
  category?: string
  dids: string[]
}

const hashSkeletonTrend = 'skeletonTrend'

export function isSkeletonTrend<V>(v: V) {
  return is$typed(v, id, hashSkeletonTrend)
}

export function validateSkeletonTrend<V>(v: V) {
  return validate<SkeletonTrend & V>(v, id, hashSkeletonTrend)
}

export interface TrendView {
  $type?: 'app.bsky.unspecced.defs#trendView'
  topic: string
  displayName: string
  link: string
  startedAt: string
  postCount: number
  status?: 'hot' | (string & {})
  category?: string
  actors: AppBskyActorDefs.ProfileViewBasic[]
}

const hashTrendView = 'trendView'

export function isTrendView<V>(v: V) {
  return is$typed(v, id, hashTrendView)
}

export function validateTrendView<V>(v: V) {
  return validate<TrendView & V>(v, id, hashTrendView)
}

export interface ThreadItemPost {
  $type?: 'app.bsky.unspecced.defs#threadItemPost'
  post: AppBskyFeedDefs.PostView
  /** This post has more parents that were not present in the response. This is just a boolean, without the number of parents. */
  moreParents: boolean
  /** This post has more replies that were not present in the response. This is a numeric value, which is best-effort and might not be accurate. */
  moreReplies: number
  /** This post is part of a contiguous thread by the OP from the thread root. Many different OP threads can happen in the same thread. */
  opThread: boolean
  /** The threadgate created by the author indicates this post as a reply to be hidden for everyone consuming the thread. */
  hiddenByThreadgate: boolean
  /** This is by an account muted by the viewer requesting it. */
  mutedByViewer: boolean
}

const hashThreadItemPost = 'threadItemPost'

export function isThreadItemPost<V>(v: V) {
  return is$typed(v, id, hashThreadItemPost)
}

export function validateThreadItemPost<V>(v: V) {
  return validate<ThreadItemPost & V>(v, id, hashThreadItemPost)
}

export interface ThreadItemNoUnauthenticated {
  $type?: 'app.bsky.unspecced.defs#threadItemNoUnauthenticated'
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
  $type?: 'app.bsky.unspecced.defs#threadItemNotFound'
}

const hashThreadItemNotFound = 'threadItemNotFound'

export function isThreadItemNotFound<V>(v: V) {
  return is$typed(v, id, hashThreadItemNotFound)
}

export function validateThreadItemNotFound<V>(v: V) {
  return validate<ThreadItemNotFound & V>(v, id, hashThreadItemNotFound)
}

export interface ThreadItemBlocked {
  $type?: 'app.bsky.unspecced.defs#threadItemBlocked'
  author: AppBskyFeedDefs.BlockedAuthor
}

const hashThreadItemBlocked = 'threadItemBlocked'

export function isThreadItemBlocked<V>(v: V) {
  return is$typed(v, id, hashThreadItemBlocked)
}

export function validateThreadItemBlocked<V>(v: V) {
  return validate<ThreadItemBlocked & V>(v, id, hashThreadItemBlocked)
}
