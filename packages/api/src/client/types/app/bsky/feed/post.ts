/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyRichtextFacet from '../richtext/facet'
import * as AppBskyEmbedImages from '../embed/images'
import * as AppBskyEmbedVideo from '../embed/video'
import * as AppBskyEmbedExternal from '../embed/external'
import * as AppBskyEmbedRecord from '../embed/record'
import * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export const id = 'app.bsky.feed.post'

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

export function isRecord<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateRecord(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Record>
}

export function isValidRecord<V>(v: V): v is V & $Typed<Record> {
  return isRecord(v) && validateRecord(v).success
}

export interface ReplyRef {
  $type?: $Type<'app.bsky.feed.post', 'replyRef'>
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
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

/** Deprecated: use facets instead. */
export interface Entity {
  $type?: $Type<'app.bsky.feed.post', 'entity'>
  index: TextSlice
  /** Expected values are 'mention' and 'link'. */
  type: string
  value: string
}

export function isEntity<V>(v: V) {
  return is$typed(v, id, 'entity')
}

export function validateEntity(v: unknown) {
  return lexicons.validate(`${id}#entity`, v) as ValidationResult<Entity>
}

export function isValidEntity<V>(v: V): v is V & $Typed<Entity> {
  return isEntity(v) && validateEntity(v).success
}

/** Deprecated. Use app.bsky.richtext instead -- A text segment. Start is inclusive, end is exclusive. Indices are for utf16-encoded strings. */
export interface TextSlice {
  $type?: $Type<'app.bsky.feed.post', 'textSlice'>
  start: number
  end: number
}

export function isTextSlice<V>(v: V) {
  return is$typed(v, id, 'textSlice')
}

export function validateTextSlice(v: unknown) {
  return lexicons.validate(`${id}#textSlice`, v) as ValidationResult<TextSlice>
}

export function isValidTextSlice<V>(v: V): v is V & $Typed<TextSlice> {
  return isTextSlice(v) && validateTextSlice(v).success
}
