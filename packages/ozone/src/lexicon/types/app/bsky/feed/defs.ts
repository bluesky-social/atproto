/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedVideo from '../embed/video'
import * as AppBskyEmbedExternal from '../embed/external'
import * as AppBskyEmbedRecord from '../embed/record'
import * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyGraphDefs from '../graph/defs'

const id = 'app.bsky.feed.defs'

export interface PostView {
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  record: {}
  embed?:
    | AppBskyEmbedImages.View
    | AppBskyEmbedVideo.View
    | AppBskyEmbedExternal.View
    | AppBskyEmbedRecord.View
    | AppBskyEmbedRecordWithMedia.View
    | { $type: string; [k: string]: unknown }
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  indexedAt: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  threadgate?: ThreadgateView
  [k: string]: unknown
}

export function isPostView(
  v: unknown,
): v is PostView & { $type: $Type<'app.bsky.feed.defs', 'postView'> } {
  return is$typed(v, id, 'postView')
}

export function validatePostView(v: unknown) {
  return lexicons.validate(`${id}#postView`, v) as ValidationResult<PostView>
}

/** Metadata about the requesting account's relationship with the subject content. Only has meaningful content for authed requests. */
export interface ViewerState {
  repost?: string
  like?: string
  threadMuted?: boolean
  replyDisabled?: boolean
  embeddingDisabled?: boolean
  pinned?: boolean
  [k: string]: unknown
}

export function isViewerState(
  v: unknown,
): v is ViewerState & { $type: $Type<'app.bsky.feed.defs', 'viewerState'> } {
  return is$typed(v, id, 'viewerState')
}

export function validateViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#viewerState`,
    v,
  ) as ValidationResult<ViewerState>
}

export interface FeedViewPost {
  post: PostView
  reply?: ReplyRef
  reason?: ReasonRepost | ReasonPin | { $type: string; [k: string]: unknown }
  /** Context provided by feed generator that may be passed back alongside interactions. */
  feedContext?: string
  [k: string]: unknown
}

export function isFeedViewPost(
  v: unknown,
): v is FeedViewPost & { $type: $Type<'app.bsky.feed.defs', 'feedViewPost'> } {
  return is$typed(v, id, 'feedViewPost')
}

export function validateFeedViewPost(v: unknown) {
  return lexicons.validate(
    `${id}#feedViewPost`,
    v,
  ) as ValidationResult<FeedViewPost>
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
  grandparentAuthor?: AppBskyActorDefs.ProfileViewBasic
  [k: string]: unknown
}

export function isReplyRef(
  v: unknown,
): v is ReplyRef & { $type: $Type<'app.bsky.feed.defs', 'replyRef'> } {
  return is$typed(v, id, 'replyRef')
}

export function validateReplyRef(v: unknown) {
  return lexicons.validate(`${id}#replyRef`, v) as ValidationResult<ReplyRef>
}

export interface ReasonRepost {
  by: AppBskyActorDefs.ProfileViewBasic
  indexedAt: string
  [k: string]: unknown
}

export function isReasonRepost(
  v: unknown,
): v is ReasonRepost & { $type: $Type<'app.bsky.feed.defs', 'reasonRepost'> } {
  return is$typed(v, id, 'reasonRepost')
}

export function validateReasonRepost(v: unknown) {
  return lexicons.validate(
    `${id}#reasonRepost`,
    v,
  ) as ValidationResult<ReasonRepost>
}

export interface ReasonPin {
  [k: string]: unknown
}

export function isReasonPin(
  v: unknown,
): v is ReasonPin & { $type: $Type<'app.bsky.feed.defs', 'reasonPin'> } {
  return is$typed(v, id, 'reasonPin')
}

export function validateReasonPin(v: unknown) {
  return lexicons.validate(`${id}#reasonPin`, v) as ValidationResult<ReasonPin>
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

export function isThreadViewPost(v: unknown): v is ThreadViewPost & {
  $type: $Type<'app.bsky.feed.defs', 'threadViewPost'>
} {
  return is$typed(v, id, 'threadViewPost')
}

export function validateThreadViewPost(v: unknown) {
  return lexicons.validate(
    `${id}#threadViewPost`,
    v,
  ) as ValidationResult<ThreadViewPost>
}

export interface NotFoundPost {
  uri: string
  notFound: true
  [k: string]: unknown
}

export function isNotFoundPost(
  v: unknown,
): v is NotFoundPost & { $type: $Type<'app.bsky.feed.defs', 'notFoundPost'> } {
  return is$typed(v, id, 'notFoundPost')
}

export function validateNotFoundPost(v: unknown) {
  return lexicons.validate(
    `${id}#notFoundPost`,
    v,
  ) as ValidationResult<NotFoundPost>
}

export interface BlockedPost {
  uri: string
  blocked: true
  author: BlockedAuthor
  [k: string]: unknown
}

export function isBlockedPost(
  v: unknown,
): v is BlockedPost & { $type: $Type<'app.bsky.feed.defs', 'blockedPost'> } {
  return is$typed(v, id, 'blockedPost')
}

export function validateBlockedPost(v: unknown) {
  return lexicons.validate(
    `${id}#blockedPost`,
    v,
  ) as ValidationResult<BlockedPost>
}

export interface BlockedAuthor {
  did: string
  viewer?: AppBskyActorDefs.ViewerState
  [k: string]: unknown
}

export function isBlockedAuthor(v: unknown): v is BlockedAuthor & {
  $type: $Type<'app.bsky.feed.defs', 'blockedAuthor'>
} {
  return is$typed(v, id, 'blockedAuthor')
}

export function validateBlockedAuthor(v: unknown) {
  return lexicons.validate(
    `${id}#blockedAuthor`,
    v,
  ) as ValidationResult<BlockedAuthor>
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

export function isGeneratorView(v: unknown): v is GeneratorView & {
  $type: $Type<'app.bsky.feed.defs', 'generatorView'>
} {
  return is$typed(v, id, 'generatorView')
}

export function validateGeneratorView(v: unknown) {
  return lexicons.validate(
    `${id}#generatorView`,
    v,
  ) as ValidationResult<GeneratorView>
}

export interface GeneratorViewerState {
  like?: string
  [k: string]: unknown
}

export function isGeneratorViewerState(
  v: unknown,
): v is GeneratorViewerState & {
  $type: $Type<'app.bsky.feed.defs', 'generatorViewerState'>
} {
  return is$typed(v, id, 'generatorViewerState')
}

export function validateGeneratorViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#generatorViewerState`,
    v,
  ) as ValidationResult<GeneratorViewerState>
}

export interface SkeletonFeedPost {
  post: string
  reason?:
    | SkeletonReasonRepost
    | SkeletonReasonPin
    | { $type: string; [k: string]: unknown }
  /** Context that will be passed through to client and may be passed to feed generator back alongside interactions. */
  feedContext?: string
  [k: string]: unknown
}

export function isSkeletonFeedPost(v: unknown): v is SkeletonFeedPost & {
  $type: $Type<'app.bsky.feed.defs', 'skeletonFeedPost'>
} {
  return is$typed(v, id, 'skeletonFeedPost')
}

export function validateSkeletonFeedPost(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonFeedPost`,
    v,
  ) as ValidationResult<SkeletonFeedPost>
}

export interface SkeletonReasonRepost {
  repost: string
  [k: string]: unknown
}

export function isSkeletonReasonRepost(
  v: unknown,
): v is SkeletonReasonRepost & {
  $type: $Type<'app.bsky.feed.defs', 'skeletonReasonRepost'>
} {
  return is$typed(v, id, 'skeletonReasonRepost')
}

export function validateSkeletonReasonRepost(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonReasonRepost`,
    v,
  ) as ValidationResult<SkeletonReasonRepost>
}

export interface SkeletonReasonPin {
  [k: string]: unknown
}

export function isSkeletonReasonPin(v: unknown): v is SkeletonReasonPin & {
  $type: $Type<'app.bsky.feed.defs', 'skeletonReasonPin'>
} {
  return is$typed(v, id, 'skeletonReasonPin')
}

export function validateSkeletonReasonPin(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonReasonPin`,
    v,
  ) as ValidationResult<SkeletonReasonPin>
}

export interface ThreadgateView {
  uri?: string
  cid?: string
  record?: {}
  lists?: AppBskyGraphDefs.ListViewBasic[]
  [k: string]: unknown
}

export function isThreadgateView(v: unknown): v is ThreadgateView & {
  $type: $Type<'app.bsky.feed.defs', 'threadgateView'>
} {
  return is$typed(v, id, 'threadgateView')
}

export function validateThreadgateView(v: unknown) {
  return lexicons.validate(
    `${id}#threadgateView`,
    v,
  ) as ValidationResult<ThreadgateView>
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
  /** Context on a feed item that was originally supplied by the feed generator on getFeedSkeleton. */
  feedContext?: string
  [k: string]: unknown
}

export function isInteraction(
  v: unknown,
): v is Interaction & { $type: $Type<'app.bsky.feed.defs', 'interaction'> } {
  return is$typed(v, id, 'interaction')
}

export function validateInteraction(v: unknown) {
  return lexicons.validate(
    `${id}#interaction`,
    v,
  ) as ValidationResult<Interaction>
}

/** Request that less content like the given feed item be shown in the feed */
export const REQUESTLESS = `${id}#requestLess`
/** Request that more content like the given feed item be shown in the feed */
export const REQUESTMORE = `${id}#requestMore`
/** User clicked through to the feed item */
export const CLICKTHROUGHITEM = `${id}#clickthroughItem`
/** User clicked through to the author of the feed item */
export const CLICKTHROUGHAUTHOR = `${id}#clickthroughAuthor`
/** User clicked through to the reposter of the feed item */
export const CLICKTHROUGHREPOSTER = `${id}#clickthroughReposter`
/** User clicked through to the embedded content of the feed item */
export const CLICKTHROUGHEMBED = `${id}#clickthroughEmbed`
/** Feed item was seen by user */
export const INTERACTIONSEEN = `${id}#interactionSeen`
/** User liked the feed item */
export const INTERACTIONLIKE = `${id}#interactionLike`
/** User reposted the feed item */
export const INTERACTIONREPOST = `${id}#interactionRepost`
/** User replied to the feed item */
export const INTERACTIONREPLY = `${id}#interactionReply`
/** User quoted the feed item */
export const INTERACTIONQUOTE = `${id}#interactionQuote`
/** User shared the feed item */
export const INTERACTIONSHARE = `${id}#interactionShare`
