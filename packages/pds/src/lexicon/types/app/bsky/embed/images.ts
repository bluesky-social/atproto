/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

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

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.images#main', v)
}

export interface Image {
  image: BlobRef
  alt: string
  [k: string]: unknown
}

export function isImage(v: unknown): v is Image {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.embed.images#image'
  )
}

export function validateImage(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.images#image', v)
}

export interface View {
  images: ViewImage[]
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) && hasProp(v, '$type') && v.$type === 'app.bsky.embed.images#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.images#view', v)
}

export interface ViewImage {
  thumb: string
  fullsize: string
  alt: string
  [k: string]: unknown
}

export function isViewImage(v: unknown): v is ViewImage {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.images#viewImage'
  )
}

export function validateViewImage(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.images#viewImage', v)
}
