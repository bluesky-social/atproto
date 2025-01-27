/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons.js'
import { isObj, hasProp } from '../../../../util.js'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../richtext/facet.js'
import * as AppBskyEmbedImages from '../embed/images.js'
import * as AppBskyEmbedVideo from '../embed/video.js'
import * as AppBskyEmbedExternal from '../embed/external.js'
import * as AppBskyEmbedRecord from '../embed/record.js'
import * as AppBskyEmbedRecordWithMedia from '../embed/recordWithMedia.js'
import * as ComAtprotoLabelDefs from '../../../com/atproto/label/defs.js'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef.js'

export interface Record {
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  /** DEPRECATED: replaced by app.bsky.richtext.facet. */
  entities?: Entity[]
  /** Annotations of text (mentions, URLs, hashtags, etc) */
  facets?: AppBskyRichtextFacet.Main[]
  reply?: ReplyRef
  embed?:
    | AppBskyEmbedImages.Main
    | AppBskyEmbedVideo.Main
    | AppBskyEmbedExternal.Main
    | AppBskyEmbedRecord.Main
    | AppBskyEmbedRecordWithMedia.Main
    | { $type: string; [k: string]: unknown }
  /** Indicates human language of post primary text content. */
  langs?: string[]
  labels?:
    | ComAtprotoLabelDefs.SelfLabels
    | { $type: string; [k: string]: unknown }
  /** Additional hashtags, in addition to any included in post text and facets. */
  tags?: string[]
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.feed.post#main' || v.$type === 'app.bsky.feed.post')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#main', v)
}

export interface ReplyRef {
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isReplyRef(v: unknown): v is ReplyRef {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.post#replyRef'
  )
}

export function validateReplyRef(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#replyRef', v)
}

/** Deprecated: use facets instead. */
export interface Entity {
  index: TextSlice
  /** Expected values are 'mention' and 'link'. */
  type: string
  value: string
  [k: string]: unknown
}

export function isEntity(v: unknown): v is Entity {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.feed.post#entity'
  )
}

export function validateEntity(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#entity', v)
}

/** Deprecated. Use app.bsky.richtext instead -- A text segment. Start is inclusive, end is exclusive. Indices are for utf16-encoded strings. */
export interface TextSlice {
  start: number
  end: number
  [k: string]: unknown
}

export function isTextSlice(v: unknown): v is TextSlice {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.feed.post#textSlice'
  )
}

export function validateTextSlice(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.feed.post#textSlice', v)
}
