/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedVideo from '../embed/video'
import * as AppBskyEmbedExternal from '../embed/external'
import * as AppBskyEmbedRecord from '../embed/record'
import * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyGraphDefs from '../graph/defs'

export const id = 'app.bsky.feed.defs'

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

export function isPostView<V>(v: V) {
  return is$typed(v, id, 'postView')
}

export function validatePostView(v: unknown) {
  return lexicons.validate(`${id}#postView`, v) as ValidationResult<PostView>
}

export function isValidPostView<V>(v: V): v is V & $Typed<PostView> {
  return isPostView(v) && validatePostView(v).success
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

export function isViewerState<V>(v: V) {
  return is$typed(v, id, 'viewerState')
}

export function validateViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#viewerState`,
    v,
  ) as ValidationResult<ViewerState>
}

export function isValidViewerState<V>(v: V): v is V & $Typed<ViewerState> {
  return isViewerState(v) && validateViewerState(v).success
}

export interface FeedViewPost {
  $type?: $Type<'app.bsky.feed.defs', 'feedViewPost'>
  post: PostView
  reply?: ReplyRef
  reason?: $Typed<ReasonRepost> | $Typed<ReasonPin> | { $type: string }
  /** Context provided by feed generator that may be passed back alongside interactions. */
  feedContext?: string
}

export function isFeedViewPost<V>(v: V) {
  return is$typed(v, id, 'feedViewPost')
}

export function validateFeedViewPost(v: unknown) {
  return lexicons.validate(
    `${id}#feedViewPost`,
    v,
  ) as ValidationResult<FeedViewPost>
}

export function isValidFeedViewPost<V>(v: V): v is V & $Typed<FeedViewPost> {
  return isFeedViewPost(v) && validateFeedViewPost(v).success
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

export function isReplyRef<V>(v: V) {
  return is$typed(v, id, 'replyRef')
}

export function validateReplyRef(v: unknown) {
  return lexicons.validate(`${id}#replyRef`, v) as ValidationResult<ReplyRef>
}

export function isValidReplyRef<V>(v: V): v is V & $Typed<ReplyRef> {
  return isReplyRef(v) && validateReplyRef(v).success
}

export interface ReasonRepost {
  $type?: $Type<'app.bsky.feed.defs', 'reasonRepost'>
  by: AppBskyActorDefs.ProfileViewBasic
  indexedAt: string
}

export function isReasonRepost<V>(v: V) {
  return is$typed(v, id, 'reasonRepost')
}

export function validateReasonRepost(v: unknown) {
  return lexicons.validate(
    `${id}#reasonRepost`,
    v,
  ) as ValidationResult<ReasonRepost>
}

export function isValidReasonRepost<V>(v: V): v is V & $Typed<ReasonRepost> {
  return isReasonRepost(v) && validateReasonRepost(v).success
}

export interface ReasonPin {
  $type?: $Type<'app.bsky.feed.defs', 'reasonPin'>
}

export function isReasonPin<V>(v: V) {
  return is$typed(v, id, 'reasonPin')
}

export function validateReasonPin(v: unknown) {
  return lexicons.validate(`${id}#reasonPin`, v) as ValidationResult<ReasonPin>
}

export function isValidReasonPin<V>(v: V): v is V & $Typed<ReasonPin> {
  return isReasonPin(v) && validateReasonPin(v).success
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

export function isThreadViewPost<V>(v: V) {
  return is$typed(v, id, 'threadViewPost')
}

export function validateThreadViewPost(v: unknown) {
  return lexicons.validate(
    `${id}#threadViewPost`,
    v,
  ) as ValidationResult<ThreadViewPost>
}

export function isValidThreadViewPost<V>(
  v: V,
): v is V & $Typed<ThreadViewPost> {
  return isThreadViewPost(v) && validateThreadViewPost(v).success
}

export interface NotFoundPost {
  $type?: $Type<'app.bsky.feed.defs', 'notFoundPost'>
  uri: string
  notFound: true
}

export function isNotFoundPost<V>(v: V) {
  return is$typed(v, id, 'notFoundPost')
}

export function validateNotFoundPost(v: unknown) {
  return lexicons.validate(
    `${id}#notFoundPost`,
    v,
  ) as ValidationResult<NotFoundPost>
}

export function isValidNotFoundPost<V>(v: V): v is V & $Typed<NotFoundPost> {
  return isNotFoundPost(v) && validateNotFoundPost(v).success
}

export interface BlockedPost {
  $type?: $Type<'app.bsky.feed.defs', 'blockedPost'>
  uri: string
  blocked: true
  author: BlockedAuthor
}

export function isBlockedPost<V>(v: V) {
  return is$typed(v, id, 'blockedPost')
}

export function validateBlockedPost(v: unknown) {
  return lexicons.validate(
    `${id}#blockedPost`,
    v,
  ) as ValidationResult<BlockedPost>
}

export function isValidBlockedPost<V>(v: V): v is V & $Typed<BlockedPost> {
  return isBlockedPost(v) && validateBlockedPost(v).success
}

export interface BlockedAuthor {
  $type?: $Type<'app.bsky.feed.defs', 'blockedAuthor'>
  did: string
  viewer?: AppBskyActorDefs.ViewerState
}

export function isBlockedAuthor<V>(v: V) {
  return is$typed(v, id, 'blockedAuthor')
}

export function validateBlockedAuthor(v: unknown) {
  return lexicons.validate(
    `${id}#blockedAuthor`,
    v,
  ) as ValidationResult<BlockedAuthor>
}

export function isValidBlockedAuthor<V>(v: V): v is V & $Typed<BlockedAuthor> {
  return isBlockedAuthor(v) && validateBlockedAuthor(v).success
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

export function isGeneratorView<V>(v: V) {
  return is$typed(v, id, 'generatorView')
}

export function validateGeneratorView(v: unknown) {
  return lexicons.validate(
    `${id}#generatorView`,
    v,
  ) as ValidationResult<GeneratorView>
}

export function isValidGeneratorView<V>(v: V): v is V & $Typed<GeneratorView> {
  return isGeneratorView(v) && validateGeneratorView(v).success
}

export interface GeneratorViewerState {
  $type?: $Type<'app.bsky.feed.defs', 'generatorViewerState'>
  like?: string
}

export function isGeneratorViewerState<V>(v: V) {
  return is$typed(v, id, 'generatorViewerState')
}

export function validateGeneratorViewerState(v: unknown) {
  return lexicons.validate(
    `${id}#generatorViewerState`,
    v,
  ) as ValidationResult<GeneratorViewerState>
}

export function isValidGeneratorViewerState<V>(
  v: V,
): v is V & $Typed<GeneratorViewerState> {
  return isGeneratorViewerState(v) && validateGeneratorViewerState(v).success
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

export function isSkeletonFeedPost<V>(v: V) {
  return is$typed(v, id, 'skeletonFeedPost')
}

export function validateSkeletonFeedPost(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonFeedPost`,
    v,
  ) as ValidationResult<SkeletonFeedPost>
}

export function isValidSkeletonFeedPost<V>(
  v: V,
): v is V & $Typed<SkeletonFeedPost> {
  return isSkeletonFeedPost(v) && validateSkeletonFeedPost(v).success
}

export interface SkeletonReasonRepost {
  $type?: $Type<'app.bsky.feed.defs', 'skeletonReasonRepost'>
  repost: string
}

export function isSkeletonReasonRepost<V>(v: V) {
  return is$typed(v, id, 'skeletonReasonRepost')
}

export function validateSkeletonReasonRepost(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonReasonRepost`,
    v,
  ) as ValidationResult<SkeletonReasonRepost>
}

export function isValidSkeletonReasonRepost<V>(
  v: V,
): v is V & $Typed<SkeletonReasonRepost> {
  return isSkeletonReasonRepost(v) && validateSkeletonReasonRepost(v).success
}

export interface SkeletonReasonPin {
  $type?: $Type<'app.bsky.feed.defs', 'skeletonReasonPin'>
}

export function isSkeletonReasonPin<V>(v: V) {
  return is$typed(v, id, 'skeletonReasonPin')
}

export function validateSkeletonReasonPin(v: unknown) {
  return lexicons.validate(
    `${id}#skeletonReasonPin`,
    v,
  ) as ValidationResult<SkeletonReasonPin>
}

export function isValidSkeletonReasonPin<V>(
  v: V,
): v is V & $Typed<SkeletonReasonPin> {
  return isSkeletonReasonPin(v) && validateSkeletonReasonPin(v).success
}

export interface ThreadgateView {
  $type?: $Type<'app.bsky.feed.defs', 'threadgateView'>
  uri?: string
  cid?: string
  record?: { [_ in string]: unknown }
  lists?: AppBskyGraphDefs.ListViewBasic[]
}

export function isThreadgateView<V>(v: V) {
  return is$typed(v, id, 'threadgateView')
}

export function validateThreadgateView(v: unknown) {
  return lexicons.validate(
    `${id}#threadgateView`,
    v,
  ) as ValidationResult<ThreadgateView>
}

export function isValidThreadgateView<V>(
  v: V,
): v is V & $Typed<ThreadgateView> {
  return isThreadgateView(v) && validateThreadgateView(v).success
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

export function isInteraction<V>(v: V) {
  return is$typed(v, id, 'interaction')
}

export function validateInteraction(v: unknown) {
  return lexicons.validate(
    `${id}#interaction`,
    v,
  ) as ValidationResult<Interaction>
}

export function isValidInteraction<V>(v: V): v is V & $Typed<Interaction> {
  return isInteraction(v) && validateInteraction(v).success
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
