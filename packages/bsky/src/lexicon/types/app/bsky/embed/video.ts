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
import type * as AppBskyEmbedDefs from './defs'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.embed.video'

export interface Main {
  $type?: $Type<'app.bsky.embed.video', 'main'>
  video: BlobRef
  captions?: Caption[]
  /** Alt text description of the video, for accessibility. */
  alt?: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain)
}

export function isValidMain<V>(v: V) {
  return isValid<Main>(v, id, hashMain)
}

export interface Caption {
  $type?: $Type<'app.bsky.embed.video', 'caption'>
  lang: string
  file: BlobRef
}

const hashCaption = 'caption'

export function isCaption<V>(v: V) {
  return is$typed(v, id, hashCaption)
}

export function validateCaption<V>(v: V) {
  return validate<Caption & V>(v, id, hashCaption)
}

export function isValidCaption<V>(v: V) {
  return isValid<Caption>(v, id, hashCaption)
}

export interface View {
  $type?: $Type<'app.bsky.embed.video', 'view'>
  cid: string
  playlist: string
  thumbnail?: string
  alt?: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

const hashView = 'view'

export function isView<V>(v: V) {
  return is$typed(v, id, hashView)
}

export function validateView<V>(v: V) {
  return validate<View & V>(v, id, hashView)
}

export function isValidView<V>(v: V) {
  return isValid<View>(v, id, hashView)
}
