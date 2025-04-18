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
import type * as AppBskyEmbedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.embed.images'

export interface Main {
  $type?: 'app.bsky.embed.images'
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
  $type?: 'app.bsky.embed.images#image'
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

export interface View {
  $type?: 'app.bsky.embed.images#view'
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
  $type?: 'app.bsky.embed.images#viewImage'
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
