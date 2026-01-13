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
import type * as AppBskyFeedPostgate from '../feed/postgate.js'
import type * as AppBskyFeedThreadgate from '../feed/threadgate.js'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.draft.defs'

/** A draft with an identifier, used to store drafts in private storage (stash). */
export interface DraftWithId {
  $type?: 'app.bsky.draft.defs#draftWithId'
  /** A TID to be used as a draft identifier. */
  id: string
  draft: Draft
}

const hashDraftWithId = 'draftWithId'

export function isDraftWithId<V>(v: V) {
  return is$typed(v, id, hashDraftWithId)
}

export function validateDraftWithId<V>(v: V) {
  return validate<DraftWithId & V>(v, id, hashDraftWithId)
}

/** A draft containing an array of draft posts. */
export interface Draft {
  $type?: 'app.bsky.draft.defs#draft'
  /** Array of draft posts that compose this draft. */
  posts: DraftPost[]
  /** Indicates human language of posts primary text content. */
  langs?: string[]
  /** Embedding rules for the postgates to be created when this draft is published. */
  postgateEmbeddingRules?: (
    | $Typed<AppBskyFeedPostgate.DisableRule>
    | { $type: string }
  )[]
  /** Allow-rules for the threadgate to be created when this draft is published. */
  threadgateAllow?: (
    | $Typed<AppBskyFeedThreadgate.MentionRule>
    | $Typed<AppBskyFeedThreadgate.FollowerRule>
    | $Typed<AppBskyFeedThreadgate.FollowingRule>
    | $Typed<AppBskyFeedThreadgate.ListRule>
    | { $type: string }
  )[]
}

const hashDraft = 'draft'

export function isDraft<V>(v: V) {
  return is$typed(v, id, hashDraft)
}

export function validateDraft<V>(v: V) {
  return validate<Draft & V>(v, id, hashDraft)
}

/** One of the posts that compose a draft. */
export interface DraftPost {
  $type?: 'app.bsky.draft.defs#draftPost'
  /** The primary post content. */
  text: string
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  embedImages?: DraftEmbedImage[]
  embedVideos?: DraftEmbedVideo[]
  embedExternals?: DraftEmbedExternal[]
  embedRecords?: DraftEmbedRecord[]
}

const hashDraftPost = 'draftPost'

export function isDraftPost<V>(v: V) {
  return is$typed(v, id, hashDraftPost)
}

export function validateDraftPost<V>(v: V) {
  return validate<DraftPost & V>(v, id, hashDraftPost)
}

/** View to present drafts data to users. */
export interface DraftView {
  $type?: 'app.bsky.draft.defs#draftView'
  /** A TID to be used as a draft identifier. */
  id: string
  draft: Draft
  /** The time the draft was created. */
  createdAt: string
  /** The time the draft was last updated. */
  updatedAt: string
}

const hashDraftView = 'draftView'

export function isDraftView<V>(v: V) {
  return is$typed(v, id, hashDraftView)
}

export function validateDraftView<V>(v: V) {
  return validate<DraftView & V>(v, id, hashDraftView)
}

export interface DraftEmbedLocalRef {
  $type?: 'app.bsky.draft.defs#draftEmbedLocalRef'
  /** Local, on-device ref to file to be embedded. Embeds are currently device-bound for drafts. */
  path: string
}

const hashDraftEmbedLocalRef = 'draftEmbedLocalRef'

export function isDraftEmbedLocalRef<V>(v: V) {
  return is$typed(v, id, hashDraftEmbedLocalRef)
}

export function validateDraftEmbedLocalRef<V>(v: V) {
  return validate<DraftEmbedLocalRef & V>(v, id, hashDraftEmbedLocalRef)
}

export interface DraftEmbedCaption {
  $type?: 'app.bsky.draft.defs#draftEmbedCaption'
  lang: string
  content: string
}

const hashDraftEmbedCaption = 'draftEmbedCaption'

export function isDraftEmbedCaption<V>(v: V) {
  return is$typed(v, id, hashDraftEmbedCaption)
}

export function validateDraftEmbedCaption<V>(v: V) {
  return validate<DraftEmbedCaption & V>(v, id, hashDraftEmbedCaption)
}

export interface DraftEmbedImage {
  $type?: 'app.bsky.draft.defs#draftEmbedImage'
  localRef: DraftEmbedLocalRef
  alt?: string
}

const hashDraftEmbedImage = 'draftEmbedImage'

export function isDraftEmbedImage<V>(v: V) {
  return is$typed(v, id, hashDraftEmbedImage)
}

export function validateDraftEmbedImage<V>(v: V) {
  return validate<DraftEmbedImage & V>(v, id, hashDraftEmbedImage)
}

export interface DraftEmbedVideo {
  $type?: 'app.bsky.draft.defs#draftEmbedVideo'
  localRef: DraftEmbedLocalRef
  alt?: string
  captions?: DraftEmbedCaption[]
}

const hashDraftEmbedVideo = 'draftEmbedVideo'

export function isDraftEmbedVideo<V>(v: V) {
  return is$typed(v, id, hashDraftEmbedVideo)
}

export function validateDraftEmbedVideo<V>(v: V) {
  return validate<DraftEmbedVideo & V>(v, id, hashDraftEmbedVideo)
}

export interface DraftEmbedExternal {
  $type?: 'app.bsky.draft.defs#draftEmbedExternal'
  uri: string
}

const hashDraftEmbedExternal = 'draftEmbedExternal'

export function isDraftEmbedExternal<V>(v: V) {
  return is$typed(v, id, hashDraftEmbedExternal)
}

export function validateDraftEmbedExternal<V>(v: V) {
  return validate<DraftEmbedExternal & V>(v, id, hashDraftEmbedExternal)
}

export interface DraftEmbedRecord {
  $type?: 'app.bsky.draft.defs#draftEmbedRecord'
  record: ComAtprotoRepoStrongRef.Main
}

const hashDraftEmbedRecord = 'draftEmbedRecord'

export function isDraftEmbedRecord<V>(v: V) {
  return is$typed(v, id, hashDraftEmbedRecord)
}

export function validateDraftEmbedRecord<V>(v: V) {
  return validate<DraftEmbedRecord & V>(v, id, hashDraftEmbedRecord)
}
