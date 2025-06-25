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
import type * as AppBskyRichtextFacet from '../richtext/facet.js'
import type * as AppBskyEmbedImages from '../embed/images.js'
import type * as AppBskyEmbedVideo from '../embed/video.js'
import type * as AppBskyEmbedExternal from '../embed/external.js'
import type * as AppBskyEmbedRecord from '../embed/record.js'
import type * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia.js'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.feed.post'

export interface Record {
  $type: 'app.bsky.feed.post'
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  /** DEPRECATED: replaced by app.bsky.richtext.facet. */
  entities?: Entity[]
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  reply?: ReplyRef
  embed?:
    | $Typed<AppBskyEmbedImages.Main>
    | $Typed<AppBskyEmbedVideo.Main>
    | $Typed<AppBskyEmbedExternal.Main>
    | $Typed<AppBskyEmbedRecord.Main>
    | $Typed<AppBskyEmbedRecordWithMedia.Main>
    | { $type: string }
  /** Indicates human language of post primary text content. */
  langs?: string[]
  labels?: $Typed<ComAtprotoLabelDefs.SelfLabels> | { $type: string }
  /** Additional hashtags, in addition to any included in post text and facets. */
  tags?: string[]
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

export interface ReplyRef {
  $type?: 'app.bsky.feed.post#replyRef'
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
}

const hashReplyRef = 'replyRef'

export function isReplyRef<V>(v: V) {
  return is$typed(v, id, hashReplyRef)
}

export function validateReplyRef<V>(v: V) {
  return validate<ReplyRef & V>(v, id, hashReplyRef)
}

/** Deprecated: use facets instead. */
export interface Entity {
  $type?: 'app.bsky.feed.post#entity'
  index: TextSlice
  /** Expected values are 'mention' and 'link'. */
  type: string
  value: string
}

const hashEntity = 'entity'

export function isEntity<V>(v: V) {
  return is$typed(v, id, hashEntity)
}

export function validateEntity<V>(v: V) {
  return validate<Entity & V>(v, id, hashEntity)
}

/** Deprecated. Use app.bsky.richtext instead -- A text segment. Start is inclusive, end is exclusive. Indices are for utf16-encoded strings. */
export interface TextSlice {
  $type?: 'app.bsky.feed.post#textSlice'
  start: number
  end: number
}

const hashTextSlice = 'textSlice'

export function isTextSlice<V>(v: V) {
  return is$typed(v, id, hashTextSlice)
}

export function validateTextSlice<V>(v: V) {
  return validate<TextSlice & V>(v, id, hashTextSlice)
}
