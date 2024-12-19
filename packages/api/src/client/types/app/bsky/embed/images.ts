/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyEmbedDefs from './defs'

const id = 'app.bsky.embed.images'

export interface Main {
  images: Image[]
  [k: string]: unknown
}

export function isMain(
  v: unknown,
): v is Main & { $type: $Type<'app.bsky.embed.images', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
}

export interface Image {
  image: BlobRef
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
  [k: string]: unknown
}

export function isImage(
  v: unknown,
): v is Image & { $type: $Type<'app.bsky.embed.images', 'image'> } {
  return is$typed(v, id, 'image')
}

export function validateImage(v: unknown) {
  return lexicons.validate(`${id}#image`, v) as ValidationResult<Image>
}

export interface View {
  images: ViewImage[]
  [k: string]: unknown
}

export function isView(
  v: unknown,
): v is View & { $type: $Type<'app.bsky.embed.images', 'view'> } {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}

export interface ViewImage {
  /** Fully-qualified URL where a thumbnail of the image can be fetched. For example, CDN location provided by the App View. */
  thumb: string
  /** Fully-qualified URL where a large version of the image can be fetched. May or may not be the exact original blob. For example, CDN location provided by the App View. */
  fullsize: string
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
  [k: string]: unknown
}

export function isViewImage(
  v: unknown,
): v is ViewImage & { $type: $Type<'app.bsky.embed.images', 'viewImage'> } {
  return is$typed(v, id, 'viewImage')
}

export function validateViewImage(v: unknown) {
  return lexicons.validate(`${id}#viewImage`, v) as ValidationResult<ViewImage>
}
