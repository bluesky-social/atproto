/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { isObj, hasProp } from '../../../../util'

export interface Main {
  images: Image[]
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.embed.images#main' ||
      v.$type === 'app.bsky.embed.images')
  )
}

export interface Image {
  image: { cid: string; mimeType: string; [k: string]: unknown }
  alt: string
  [k: string]: unknown
}

export function isImage(v: unknown): v is Image {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.embed.images#image'
  )
}

export interface Presented {
  images: PresentedImage[]
  [k: string]: unknown
}

export function isPresented(v: unknown): v is Presented {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.images#presented'
  )
}

export interface PresentedImage {
  thumb: string
  fullsize: string
  alt: string
  [k: string]: unknown
}

export function isPresentedImage(v: unknown): v is PresentedImage {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.images#presentedImage'
  )
}
