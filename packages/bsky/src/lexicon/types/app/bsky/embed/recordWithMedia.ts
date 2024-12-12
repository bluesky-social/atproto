/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'
import * as AppBskyEmbedRecord from './record'
import * as AppBskyEmbedImages from './images'
import * as AppBskyEmbedVideo from './video'
import * as AppBskyEmbedExternal from './external'

const id = 'app.bsky.embed.recordWithMedia'

export interface Main {
  record: AppBskyEmbedRecord.Main
  media:
    | AppBskyEmbedImages.Main
    | AppBskyEmbedVideo.Main
    | AppBskyEmbedExternal.Main
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export function isMain(
  v: unknown,
): v is Main & { $type: $Type<'app.bsky.embed.recordWithMedia', 'main'> } {
  return is$typed(v, id, 'main')
}

export function validateMain(v: unknown) {
  return lexicons.validate(`${id}#main`, v) as ValidationResult<Main>
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

export function isView(
  v: unknown,
): v is View & { $type: $Type<'app.bsky.embed.recordWithMedia', 'view'> } {
  return is$typed(v, id, 'view')
}

export function validateView(v: unknown) {
  return lexicons.validate(`${id}#view`, v) as ValidationResult<View>
}
