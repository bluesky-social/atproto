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
import type * as AppSokaaEmbedVideo from './video.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.sokaa.embed.images'

export interface Main {
  $type?: 'app.sokaa.embed.images'
  images: Image[]
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain)
}

export interface Image {
  $type?: 'app.sokaa.embed.images#image'
  image: BlobRef
  /** Alt text for the image, for accessibility. */
  alt: string
  aspectRatio?: AppSokaaEmbedVideo.AspectRatio
}

const hashImage = 'image'

export function isImage<V>(v: V) {
  return is$typed(v, id, hashImage)
}

export function validateImage<V>(v: V) {
  return validate<Image & V>(v, id, hashImage)
}

export interface View {
  $type?: 'app.sokaa.embed.images#view'
  images: ViewImage[]
}

const hashView = 'view'

export function isView<V>(v: V) {
  return is$typed(v, id, hashView)
}

export function validateView<V>(v: V) {
  return validate<View & V>(v, id, hashView)
}

export interface ViewImage {
  $type?: 'app.sokaa.embed.images#viewImage'
  thumb: string
  fullsize: string
  alt: string
  aspectRatio?: AppSokaaEmbedVideo.AspectRatio
}

const hashViewImage = 'viewImage'

export function isViewImage<V>(v: V) {
  return is$typed(v, id, hashViewImage)
}

export function validateViewImage<V>(v: V) {
  return validate<ViewImage & V>(v, id, hashViewImage)
}
