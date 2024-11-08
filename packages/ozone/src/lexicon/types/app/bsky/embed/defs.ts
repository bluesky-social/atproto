/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

/** width:height represents an aspect ratio. It may be approximate, and may not correspond to absolute dimensions in any given unit. */
export interface AspectRatio {
  width: number
  height: number
  [k: string]: unknown
}

export function isAspectRatio(v: unknown): v is AspectRatio {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.defs#aspectRatio'
  )
}

export function validateAspectRatio(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.defs#aspectRatio', v)
}

/** Indicates that this video should be presented as a normal video - i.e. with sound, a progress bar, etc. */
export interface VideoPresentation {
  [k: string]: unknown
}

export function isVideoPresentation(v: unknown): v is VideoPresentation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.defs#videoPresentation'
  )
}

export function validateVideoPresentation(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.defs#videoPresentation', v)
}

/** Indicates that this video should be presented as a GIF - i.e. with no sound, looping, etc. */
export interface GifPresentation {
  [k: string]: unknown
}

export function isGifPresentation(v: unknown): v is GifPresentation {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.defs#gifPresentation'
  )
}

export function validateGifPresentation(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.defs#gifPresentation', v)
}
