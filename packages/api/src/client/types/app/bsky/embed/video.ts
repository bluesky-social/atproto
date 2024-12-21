/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyEmbedDefs from './defs'

const id = 'app.bsky.embed.video'

export interface Main {
  video: BlobRef
  captions?: Caption[]
  /** Alt text description of the video, for accessibility. */
  alt?: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
  [k: string]: unknown
}

export function isMain(
  v: unknown,
): v is Main & { $type: $Type<'app.bsky.embed.video', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export interface Caption {
  lang: string
  file: BlobRef
  [k: string]: unknown
}

export function isCaption(
  v: unknown,
): v is Caption & { $type: $Type<'app.bsky.embed.video', 'caption'> } {
  return is$typed(v, id, 'caption')
}

export function validateCaption(v: unknown) {
  return lexicons.validate(`${id}#caption`, v) as ValidationResult<Caption>
}

export interface View {
  cid: string
  playlist: string
  thumbnail?: string
  alt?: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
  [k: string]: unknown
}

export function isView(
  v: unknown,
): v is View & { $type: $Type<'app.bsky.embed.video', 'view'> } {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}
