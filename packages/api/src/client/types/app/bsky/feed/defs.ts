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
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyGraphDefs from '../graph/defs'

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
  labels?: ComAtprotoLabelDefs.Label[]
  threadgate?: ThreadgateView
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

/** Metadata about the requesting account's relationship with the subject content. Only has meaningful content for authed requests. */
export interface ViewerState {
  repost?: string
  like?: string
  replyDisabled?: boolean
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
  /** Context provided by feed generator that may be passed back alongside interactions. */
  feedContext?: string
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
  root:
    | PostView
    | NotFoundPost
    | BlockedPost
    | { $type: string; [k: string]: unknown }
  parent:
    | PostView
    | NotFoundPost
    | BlockedPost
    | { $type: string; [k: string]: unknown }
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
    | BlockedPost
    | { $type: string; [k: string]: unknown }
  replies?: (
    | ThreadViewPost
    | NotFoundPost
    | BlockedPost
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

export interface BlockedPost {
  uri: string
  blocked: true
  author: BlockedAuthor
  [k: string]: unknown
}

export function isBlockedPost(v: unknown): v is BlockedPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#blockedPost'
  )
}

export function validateBlockedPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#blockedPost', v)
}

export interface BlockedAuthor {
  did: string
  viewer?: AppBskyActorDefs.ViewerState
  [k: string]: unknown
}

export function isBlockedAuthor(v: unknown): v is BlockedAuthor {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#blockedAuthor'
  )
}

export function validateBlockedAuthor(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#blockedAuthor', v)
}

export interface GeneratorView {
  uri: string
  cid: string
  did: string
  creator: AppBskyActorDefs.ProfileView
  displayName: string
  description?: string
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  avatar?: string
  likeCount?: number
  acceptsInteractions?: boolean
  labels?: ComAtprotoLabelDefs.Label[]
  viewer?: GeneratorViewerState
  indexedAt: string
  [k: string]: unknown
}

export function isGeneratorView(v: unknown): v is GeneratorView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#generatorView'
  )
}

export function validateGeneratorView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#generatorView', v)
}

export interface GeneratorViewerState {
  like?: string
  [k: string]: unknown
}

export function isGeneratorViewerState(v: unknown): v is GeneratorViewerState {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#generatorViewerState'
  )
}

export function validateGeneratorViewerState(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#generatorViewerState', v)
}

export interface SkeletonFeedPost {
  post: string
  reason?: SkeletonReasonRepost | { $type: string; [k: string]: unknown }
  /** Context that will be passed through to client and may be passed to feed generator back alongside interactions. */
  feedContext?: string
  [k: string]: unknown
}

export function isSkeletonFeedPost(v: unknown): v is SkeletonFeedPost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#skeletonFeedPost'
  )
}

export function validateSkeletonFeedPost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#skeletonFeedPost', v)
}

export interface SkeletonReasonRepost {
  repost: string
  [k: string]: unknown
}

export function isSkeletonReasonRepost(v: unknown): v is SkeletonReasonRepost {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#skeletonReasonRepost'
  )
}

export function validateSkeletonReasonRepost(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#skeletonReasonRepost', v)
}

export interface ThreadgateView {
  uri?: string
  cid?: string
  record?: {}
  lists?: AppBskyGraphDefs.ListViewBasic[]
  [k: string]: unknown
}

export function isThreadgateView(v: unknown): v is ThreadgateView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#threadgateView'
  )
}

export function validateThreadgateView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#threadgateView', v)
}

export interface Interaction {
  item?: string
  event?:
    | 'app.bsky.feed.defs#requestLess'
    | 'app.bsky.feed.defs#requestMore'
    | 'app.bsky.feed.defs#clickthroughItem'
    | 'app.bsky.feed.defs#clickthroughAuthor'
    | 'app.bsky.feed.defs#clickthroughReposter'
    | 'app.bsky.feed.defs#clickthroughEmbed'
    | 'app.bsky.feed.defs#interactionSeen'
    | 'app.bsky.feed.defs#interactionLike'
    | 'app.bsky.feed.defs#interactionRepost'
    | 'app.bsky.feed.defs#interactionReply'
    | 'app.bsky.feed.defs#interactionQuote'
    | 'app.bsky.feed.defs#interactionShare'
    | (string & {})
  /** Context on a feed item that was orginally supplied by the feed generator on getFeedSkeleton. */
  feedContext?: string
  [k: string]: unknown
}

export function isInteraction(v: unknown): v is Interaction {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.defs#interaction'
  )
}

export function validateInteraction(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.defs#interaction', v)
}

/** Request that less content like the given feed item be shown in the feed */
export const REQUESTLESS = 'app.bsky.feed.defs#requestLess'
/** Request that more content like the given feed item be shown in the feed */
export const REQUESTMORE = 'app.bsky.feed.defs#requestMore'
/** User clicked through to the feed item */
export const CLICKTHROUGHITEM = 'app.bsky.feed.defs#clickthroughItem'
/** User clicked through to the author of the feed item */
export const CLICKTHROUGHAUTHOR = 'app.bsky.feed.defs#clickthroughAuthor'
/** User clicked through to the reposter of the feed item */
export const CLICKTHROUGHREPOSTER = 'app.bsky.feed.defs#clickthroughReposter'
/** User clicked through to the embedded content of the feed item */
export const CLICKTHROUGHEMBED = 'app.bsky.feed.defs#clickthroughEmbed'
/** Feed item was seen by user */
export const INTERACTIONSEEN = 'app.bsky.feed.defs#interactionSeen'
/** User liked the feed item */
export const INTERACTIONLIKE = 'app.bsky.feed.defs#interactionLike'
/** User reposted the feed item */
export const INTERACTIONREPOST = 'app.bsky.feed.defs#interactionRepost'
/** User replied to the feed item */
export const INTERACTIONREPLY = 'app.bsky.feed.defs#interactionReply'
/** User quoted the feed item */
export const INTERACTIONQUOTE = 'app.bsky.feed.defs#interactionQuote'
/** User shared the feed item */
export const INTERACTIONSHARE = 'app.bsky.feed.defs#interactionShare'
