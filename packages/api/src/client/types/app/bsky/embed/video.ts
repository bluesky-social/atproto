/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyEmbedDefs from './defs'

export const id = 'app.bsky.embed.video'

export interface Main {
  $type?: $Type<'app.bsky.embed.video', 'main'>
  video: BlobRef
  captions?: Caption[]
  /** Alt text description of the video, for accessibility. */
  alt?: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

export function isMain<V>(v: V) {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export function isValidMain<V>(v: V): v is V & $Typed<Main> {
  return isMain(v) && validateMain(v).success
}

export interface Caption {
  $type?: $Type<'app.bsky.embed.video', 'caption'>
  lang: string
  file: BlobRef
}

export function isCaption<V>(v: V) {
  return is$typed(v, id, 'caption')
}

export function validateCaption(v: unknown) {
  return lexicons.validate(`${id}#caption`, v) as ValidationResult<Caption>
}

export function isValidCaption<V>(v: V): v is V & $Typed<Caption> {
  return isCaption(v) && validateCaption(v).success
}

export interface View {
  $type?: $Type<'app.bsky.embed.video', 'view'>
  cid: string
  playlist: string
  thumbnail?: string
  alt?: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

export function isView<V>(v: V) {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}

export function isValidView<V>(v: V): v is V & $Typed<View> {
  return isView(v) && validateView(v).success
}
