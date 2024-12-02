/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import * as AppBskyEmbedRecord from './record'
import * as AppBskyEmbedImages from './images'
import * as AppBskyEmbedVideo from './video'
import * as AppBskyEmbedExternal from './external'

export const id = 'app.bsky.embed.recordWithMedia'

export interface Main {
  $type?: $Type<'app.bsky.embed.recordWithMedia', 'main'>
  record: AppBskyEmbedRecord.Main
  media:
    | $Typed<AppBskyEmbedImages.Main>
    | $Typed<AppBskyEmbedVideo.Main>
    | $Typed<AppBskyEmbedExternal.Main>
    | { $type: string }
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

export interface View {
  $type?: $Type<'app.bsky.embed.recordWithMedia', 'view'>
  record: AppBskyEmbedRecord.View
  media:
    | $Typed<AppBskyEmbedImages.View>
    | $Typed<AppBskyEmbedVideo.View>
    | $Typed<AppBskyEmbedExternal.View>
    | { $type: string }
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
