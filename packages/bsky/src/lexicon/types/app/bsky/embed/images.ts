/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as AppBskyEmbedDefs from './defs'

export const id = 'app.bsky.embed.images'

export interface Main {
  $type?: $Type<'app.bsky.embed.images', 'main'>
  images: Image[]
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

export interface Image {
  $type?: $Type<'app.bsky.embed.images', 'image'>
  image: BlobRef
  /** Alt text description of the image, for accessibility. */
  alt: string
  aspectRatio?: AppBskyEmbedDefs.AspectRatio
}

export function isImage<V>(v: V) {
  return is$typed(v, id, 'image')
}

export function validateImage(v: unknown) {
  return lexicons.validate(`${id}#image`, v) as ValidationResult<Image>
}

export function isValidImage<V>(v: V): v is V & $Typed<Image> {
  return isImage(v) && validateImage(v).success
}

export interface View {
  $type?: $Type<'app.bsky.embed.images', 'view'>
  images: ViewImage[]
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

export function isViewImage<V>(v: V) {
  return is$typed(v, id, 'viewImage')
}

export function validateViewImage(v: unknown) {
  return lexicons.validate(`${id}#viewImage`, v) as ValidationResult<ViewImage>
}

export function isValidViewImage<V>(v: V): v is V & $Typed<ViewImage> {
  return isViewImage(v) && validateViewImage(v).success
}
