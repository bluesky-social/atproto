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
import type * as AppBskyRichtextFacet from '../richtext/facet'
import type * as AppBskyEmbedImages from '../embed/images'
import type * as AppBskyEmbedVideo from '../embed/video'
import type * as AppBskyEmbedExternal from '../embed/external'
import type * as AppBskyEmbedRecord from '../embed/record'
import type * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia'
import type * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.feed.post'

export interface Record {
  $type?: $Type<'app.bsky.feed.post', 'main'>
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
  return validate<Record & V>(v, id, hashRecord)
}

export function isValidRecord<V>(v: V) {
  return isValid<Record>(v, id, hashRecord, true)
}

export interface ReplyRef {
  $type?: $Type<'app.bsky.feed.post', 'replyRef'>
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

export function isValidReplyRef<V>(v: V) {
  return isValid<ReplyRef>(v, id, hashReplyRef)
}

/** Deprecated: use facets instead. */
export interface Entity {
  $type?: $Type<'app.bsky.feed.post', 'entity'>
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

export function isValidEntity<V>(v: V) {
  return isValid<Entity>(v, id, hashEntity)
}

/** Deprecated. Use app.bsky.richtext instead -- A text segment. Start is inclusive, end is exclusive. Indices are for utf16-encoded strings. */
export interface TextSlice {
  $type?: $Type<'app.bsky.feed.post', 'textSlice'>
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

export function isValidTextSlice<V>(v: V) {
  return isValid<TextSlice>(v, id, hashTextSlice)
}
