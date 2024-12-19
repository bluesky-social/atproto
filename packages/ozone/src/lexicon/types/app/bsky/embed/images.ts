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
const id = 'app.bsky.embed.images'

export interface Main {
  $type?: $Type<'app.bsky.embed.images', 'main'>
  images: Image[]
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

export interface Image {
  $type?: $Type<'app.bsky.embed.images', 'image'>
  image: BlobRef
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

const hashImage = 'image'

export function isImage<V>(v: V) {
  return is$typed(v, id, hashImage)
}

export function validateImage<V>(v: V) {
  return validate<Image & V>(v, id, hashImage)
}

export function isValidImage<V>(v: V) {
  return isValid<Image>(v, id, hashImage)
}

export interface View {
  $type?: $Type<'app.bsky.embed.images', 'view'>
  images: ViewImage[]
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

export interface ViewImage {
  $type?: $Type<'app.bsky.embed.images', 'viewImage'>
  /** Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View. */
  thumb: string
  /** Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View. */
  fullsize: string
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

const hashViewImage = 'viewImage'

export function isViewImage<V>(v: V) {
  return is$typed(v, id, hashViewImage)
}

export function validateViewImage<V>(v: V) {
  return validate<ViewImage & V>(v, id, hashViewImage)
}

export function isValidViewImage<V>(v: V) {
  return isValid<ViewImage>(v, id, hashViewImage)
}
