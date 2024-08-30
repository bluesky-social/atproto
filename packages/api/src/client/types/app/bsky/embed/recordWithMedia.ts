/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyEmbedRecord from './record'
import * as AppBskyEmbedImages from './images'
import * as AppBskyEmbedVideo from './video'
import * as AppBskyEmbedExternal from './external'

export interface Main {
  record: AppBskyEmbedRecord.Main
  media:
    | AppBskyEmbedImages.Main
    | AppBskyEmbedVideo.Main
    | AppBskyEmbedExternal.Main
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'app.bsky.embed.recordWithMedia#main' ||
      v.$type === 'app.bsky.embed.recordWithMedia')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.recordWithMedia#main', v)
}

export interface View {
  record: AppBskyEmbedRecord.View
  media:
    | AppBskyEmbedImages.View
    | AppBskyEmbedVideo.View
    | AppBskyEmbedExternal.View
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isView(v: unknown): v is View {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.embed.recordWithMedia#view'
  )
}

export function validateView(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.embed.recordWithMedia#view', v)
}
