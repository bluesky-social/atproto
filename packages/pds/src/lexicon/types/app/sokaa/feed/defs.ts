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
import type * as AppSokaaActorDefs from '../actor/defs.js'
import type * as AppSokaaFeedPost from './post.js'
import type * as AppSokaaEmbedVideo from '../embed/video.js'
import type * as AppSokaaEmbedImages from '../embed/images.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.sokaa.feed.defs'

/** A fully hydrated view of a Sokaa post, as returned by the AppView. */
export interface PostView {
  $type?: 'app.sokaa.feed.defs#postView'
  uri: string
  cid: string
  author: AppSokaaActorDefs.ProfileViewBasic
  record: AppSokaaFeedPost.Main
  embed?:
    | $Typed<AppSokaaEmbedVideo.View>
    | $Typed<AppSokaaEmbedImages.View>
    | { $type: string }
  likeCount?: number
  viewer?: ViewerState
  indexedAt: string
}

const hashPostView = 'postView'

export function isPostView<V>(v: V) {
  return is$typed(v, id, hashPostView)
}

export function validatePostView<V>(v: V) {
  return validate<PostView & V>(v, id, hashPostView)
}

/** A post as it appears in a feed list response. */
export interface FeedViewPost {
  $type?: 'app.sokaa.feed.defs#feedViewPost'
  post: PostView
}

const hashFeedViewPost = 'feedViewPost'

export function isFeedViewPost<V>(v: V) {
  return is$typed(v, id, hashFeedViewPost)
}

export function validateFeedViewPost<V>(v: V) {
  return validate<FeedViewPost & V>(v, id, hashFeedViewPost)
}

/** Authenticated viewer's interaction state with a post. */
export interface ViewerState {
  $type?: 'app.sokaa.feed.defs#viewerState'
  /** AT-URI of the viewer's like record for this post, if they liked it. */
  like?: string
}

const hashViewerState = 'viewerState'

export function isViewerState<V>(v: V) {
  return is$typed(v, id, hashViewerState)
}

export function validateViewerState<V>(v: V) {
  return validate<ViewerState & V>(v, id, hashViewerState)
}
