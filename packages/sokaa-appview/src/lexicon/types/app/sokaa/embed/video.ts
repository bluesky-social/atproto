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

const is$typed = _is$typed,
  validate = _validate
const id = 'app.sokaa.embed.video'

export interface Main {
  $type?: 'app.sokaa.embed.video'
  /** The video file. Maximum 500MB (supports up to 4K resolution). */
  video: BlobRef
  /** A still image preview frame for the video. */
  thumbnail?: BlobRef
  /** Alt text description of the video, for accessibility. */
  alt?: string
  /** Duration of the video in seconds. */
  duration?: number
  aspectRatio?: AspectRatio
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain)
}

/** Width:height ratio of the video frame. */
export interface AspectRatio {
  $type?: 'app.sokaa.embed.video#aspectRatio'
  width: number
  height: number
}

const hashAspectRatio = 'aspectRatio'

export function isAspectRatio<V>(v: V) {
  return is$typed(v, id, hashAspectRatio)
}

export function validateAspectRatio<V>(v: V) {
  return validate<AspectRatio & V>(v, id, hashAspectRatio)
}

/** Hydrated video view returned by the AppView. */
export interface View {
  $type?: 'app.sokaa.embed.video#view'
  cid: string
  /** HLS/DASH playlist URL served by the media CDN. */
  playlist: string
  thumbnail?: string
  alt?: string
  duration?: number
  aspectRatio?: AspectRatio
}

const hashView = 'view'

export function isView<V>(v: V) {
  return is$typed(v, id, hashView)
}

export function validateView<V>(v: V) {
  return validate<View & V>(v, id, hashView)
}
