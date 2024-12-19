/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import type * as AppBskyActorDefs from '../actor/defs'
import type * as AppBskyEmbedImages from '../embed/images'
import type * as AppBskyEmbedVideo from '../embed/video'
import type * as AppBskyEmbedExternal from '../embed/external'
import type * as AppBskyEmbedRecord from '../embed/record'
import type * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import type * as AppBskyRichtextFacet from '../richtext/facet'
import type * as AppBskyGraphDefs from '../graph/defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.feed.defs'

export interface PostView {
  $type?: $Type<'app.bsky.feed.defs', 'postView'>
  uri: string
  cid: string
  author: AppBskyActorDefs.ProfileViewBasic
  record: { [_ in string]: unknown }
  embed?:
    | $Typed<AppBskyEmbedImages.View>
    | $Typed<AppBskyEmbedVideo.View>
    | $Typed<AppBskyEmbedExternal.View>
    | $Typed<AppBskyEmbedRecord.View>
    | $Typed<AppBskyEmbedRecordWithMedia.View>
    | { $type: string }
  replyCount?: number
  repostCount?: number
  likeCount?: number
  quoteCount?: number
  indexedAt: string
  viewer?: ViewerState
  labels?: ComAtprotoLabelDefs.Label[]
  threadgate?: ThreadgateView
}

const hashPostView = 'postView'

export function isPostView<V>(v: V) {
  return is$typed(v, id, hashPostView)
}

export function validatePostView<V>(v: V) {
  return validate<PostView & V>(v, id, hashPostView)
}

export function isValidPostView<V>(v: V) {
  return isValid<PostView>(v, id, hashPostView)
}

/** Metadata about the requesting account's relationship with the subject content. Only has meaningful content for authed requests. */
export interface ViewerState {
  $type?: $Type<'app.bsky.feed.defs', 'viewerState'>
  repost?: string
  like?: string
  threadMuted?: boolean
  replyDisabled?: boolean
  embeddingDisabled?: boolean
  pinned?: boolean
}

const hashViewerState = 'viewerState'

export function isViewerState<V>(v: V) {
  return is$typed(v, id, hashViewerState)
}

export function validateViewerState<V>(v: V) {
  return validate<ViewerState & V>(v, id, hashViewerState)
}

export function isValidViewerState<V>(v: V) {
  return isValid<ViewerState>(v, id, hashViewerState)
}

export interface FeedViewPost {
  $type?: $Type<'app.bsky.feed.defs', 'feedViewPost'>
  post: PostView
  reply?: ReplyRef
  reason?: $Typed<ReasonRepost> | $Typed<ReasonPin> | { $type: string }
  /** Context provided by feed generator that may be passed back alongside interactions. */
  feedContext?: string
}

const hashFeedViewPost = 'feedViewPost'

export function isFeedViewPost<V>(v: V) {
  return is$typed(v, id, hashFeedViewPost)
}

export function validateFeedViewPost<V>(v: V) {
  return validate<FeedViewPost & V>(v, id, hashFeedViewPost)
}

export function isValidFeedViewPost<V>(v: V) {
  return isValid<FeedViewPost>(v, id, hashFeedViewPost)
}

export interface ReplyRef {
  $type?: $Type<'app.bsky.feed.defs', 'replyRef'>
  root:
    | $Typed<PostView>
    | $Typed<NotFoundPost>
    | $Typed<BlockedPost>
    | { $type: string }
  parent:
    | $Typed<PostView>
    | $Typed<NotFoundPost>
    | $Typed<BlockedPost>
    | { $type: string }
  grandparentAuthor?: AppBskyActorDefs.ProfileViewBasic
}

const hashReplyRef = 'replyRef'

export function isReplyRef<V>(v: V) {
  return is$typed(v, id, hashReplyRef)
}

export function validateReplyRef<V>(v: V) {
  return validate<ReplyRef & V>(v, id, hashReplyRef)
}

export function isValidReplyRef<V>(v: V) {
  return isValid<ReplyRef>(v, id, hashReplyRef)
}

export interface ReasonRepost {
  $type?: $Type<'app.bsky.feed.defs', 'reasonRepost'>
  by: AppBskyActorDefs.ProfileViewBasic
  indexedAt: string
}

const hashReasonRepost = 'reasonRepost'

export function isReasonRepost<V>(v: V) {
  return is$typed(v, id, hashReasonRepost)
}

export function validateReasonRepost<V>(v: V) {
  return validate<ReasonRepost & V>(v, id, hashReasonRepost)
}

export function isValidReasonRepost<V>(v: V) {
  return isValid<ReasonRepost>(v, id, hashReasonRepost)
}

export interface ReasonPin {
  $type?: $Type<'app.bsky.feed.defs', 'reasonPin'>
}

const hashReasonPin = 'reasonPin'

export function isReasonPin<V>(v: V) {
  return is$typed(v, id, hashReasonPin)
}

export function validateReasonPin<V>(v: V) {
  return validate<ReasonPin & V>(v, id, hashReasonPin)
}

export function isValidReasonPin<V>(v: V) {
  return isValid<ReasonPin>(v, id, hashReasonPin)
}

export interface ThreadViewPost {
  $type?: $Type<'app.bsky.feed.defs', 'threadViewPost'>
  post: PostView
  parent?:
    | $Typed<ThreadViewPost>
    | $Typed<NotFoundPost>
    | $Typed<BlockedPost>
    | { $type: string }
  replies?: (
    | $Typed<ThreadViewPost>
    | $Typed<NotFoundPost>
    | $Typed<BlockedPost>
    | { $type: string }
  )[]
}

const hashThreadViewPost = 'threadViewPost'

export function isThreadViewPost<V>(v: V) {
  return is$typed(v, id, hashThreadViewPost)
}

export function validateThreadViewPost<V>(v: V) {
  return validate<ThreadViewPost & V>(v, id, hashThreadViewPost)
}

export function isValidThreadViewPost<V>(v: V) {
  return isValid<ThreadViewPost>(v, id, hashThreadViewPost)
}

export interface NotFoundPost {
  $type?: $Type<'app.bsky.feed.defs', 'notFoundPost'>
  uri: string
  notFound: true
}

const hashNotFoundPost = 'notFoundPost'

export function isNotFoundPost<V>(v: V) {
  return is$typed(v, id, hashNotFoundPost)
}

export function validateNotFoundPost<V>(v: V) {
  return validate<NotFoundPost & V>(v, id, hashNotFoundPost)
}

export function isValidNotFoundPost<V>(v: V) {
  return isValid<NotFoundPost>(v, id, hashNotFoundPost)
}

export interface BlockedPost {
  $type?: $Type<'app.bsky.feed.defs', 'blockedPost'>
  uri: string
  blocked: true
  author: BlockedAuthor
}

const hashBlockedPost = 'blockedPost'

export function isBlockedPost<V>(v: V) {
  return is$typed(v, id, hashBlockedPost)
}

export function validateBlockedPost<V>(v: V) {
  return validate<BlockedPost & V>(v, id, hashBlockedPost)
}

export function isValidBlockedPost<V>(v: V) {
  return isValid<BlockedPost>(v, id, hashBlockedPost)
}

export interface BlockedAuthor {
  $type?: $Type<'app.bsky.feed.defs', 'blockedAuthor'>
  did: string
  viewer?: AppBskyActorDefs.ViewerState
}

const hashBlockedAuthor = 'blockedAuthor'

export function isBlockedAuthor<V>(v: V) {
  return is$typed(v, id, hashBlockedAuthor)
}

export function validateBlockedAuthor<V>(v: V) {
  return validate<BlockedAuthor & V>(v, id, hashBlockedAuthor)
}

export function isValidBlockedAuthor<V>(v: V) {
  return isValid<BlockedAuthor>(v, id, hashBlockedAuthor)
}

export interface GeneratorView {
  $type?: $Type<'app.bsky.feed.defs', 'generatorView'>
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
}

const hashGeneratorView = 'generatorView'

export function isGeneratorView<V>(v: V) {
  return is$typed(v, id, hashGeneratorView)
}

export function validateGeneratorView<V>(v: V) {
  return validate<GeneratorView & V>(v, id, hashGeneratorView)
}

export function isValidGeneratorView<V>(v: V) {
  return isValid<GeneratorView>(v, id, hashGeneratorView)
}

export interface GeneratorViewerState {
  $type?: $Type<'app.bsky.feed.defs', 'generatorViewerState'>
  like?: string
}

const hashGeneratorViewerState = 'generatorViewerState'

export function isGeneratorViewerState<V>(v: V) {
  return is$typed(v, id, hashGeneratorViewerState)
}

export function validateGeneratorViewerState<V>(v: V) {
  return validate<GeneratorViewerState & V>(v, id, hashGeneratorViewerState)
}

export function isValidGeneratorViewerState<V>(v: V) {
  return isValid<GeneratorViewerState>(v, id, hashGeneratorViewerState)
}

export interface SkeletonFeedPost {
  $type?: $Type<'app.bsky.feed.defs', 'skeletonFeedPost'>
  post: string
  reason?:
    | $Typed<SkeletonReasonRepost>
    | $Typed<SkeletonReasonPin>
    | { $type: string }
  /** Context that will be passed through to client and may be passed to feed generator back alongside interactions. */
  feedContext?: string
}

const hashSkeletonFeedPost = 'skeletonFeedPost'

export function isSkeletonFeedPost<V>(v: V) {
  return is$typed(v, id, hashSkeletonFeedPost)
}

export function validateSkeletonFeedPost<V>(v: V) {
  return validate<SkeletonFeedPost & V>(v, id, hashSkeletonFeedPost)
}

export function isValidSkeletonFeedPost<V>(v: V) {
  return isValid<SkeletonFeedPost>(v, id, hashSkeletonFeedPost)
}

export interface SkeletonReasonRepost {
  $type?: $Type<'app.bsky.feed.defs', 'skeletonReasonRepost'>
  repost: string
}

const hashSkeletonReasonRepost = 'skeletonReasonRepost'

export function isSkeletonReasonRepost<V>(v: V) {
  return is$typed(v, id, hashSkeletonReasonRepost)
}

export function validateSkeletonReasonRepost<V>(v: V) {
  return validate<SkeletonReasonRepost & V>(v, id, hashSkeletonReasonRepost)
}

export function isValidSkeletonReasonRepost<V>(v: V) {
  return isValid<SkeletonReasonRepost>(v, id, hashSkeletonReasonRepost)
}

export interface SkeletonReasonPin {
  $type?: $Type<'app.bsky.feed.defs', 'skeletonReasonPin'>
}

const hashSkeletonReasonPin = 'skeletonReasonPin'

export function isSkeletonReasonPin<V>(v: V) {
  return is$typed(v, id, hashSkeletonReasonPin)
}

export function validateSkeletonReasonPin<V>(v: V) {
  return validate<SkeletonReasonPin & V>(v, id, hashSkeletonReasonPin)
}

export function isValidSkeletonReasonPin<V>(v: V) {
  return isValid<SkeletonReasonPin>(v, id, hashSkeletonReasonPin)
}

export interface ThreadgateView {
  $type?: $Type<'app.bsky.feed.defs', 'threadgateView'>
  uri?: string
  cid?: string
  record?: { [_ in string]: unknown }
  lists?: AppBskyGraphDefs.ListViewBasic[]
}

const hashThreadgateView = 'threadgateView'

export function isThreadgateView<V>(v: V) {
  return is$typed(v, id, hashThreadgateView)
}

export function validateThreadgateView<V>(v: V) {
  return validate<ThreadgateView & V>(v, id, hashThreadgateView)
}

export function isValidThreadgateView<V>(v: V) {
  return isValid<ThreadgateView>(v, id, hashThreadgateView)
}

export interface Interaction {
  $type?: $Type<'app.bsky.feed.defs', 'interaction'>
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
}

const hashInteraction = 'interaction'

export function isInteraction<V>(v: V) {
  return is$typed(v, id, hashInteraction)
}

export function validateInteraction<V>(v: V) {
  return validate<Interaction & V>(v, id, hashInteraction)
}

export function isValidInteraction<V>(v: V) {
  return isValid<Interaction>(v, id, hashInteraction)
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
