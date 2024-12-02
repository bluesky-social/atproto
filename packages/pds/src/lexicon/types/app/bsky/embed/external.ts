/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'

export const id = 'app.bsky.embed.external'

/** A representation of some externally linked content (eg, a URL and 'card'), embedded in a Bluesky record (eg, a post). */
export interface Main {
  $type?: $Type<'app.bsky.embed.external', 'main'>
  external: External
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

export interface External {
  $type?: $Type<'app.bsky.embed.external', 'external'>
  uri: string
  title: string
  description: string
  thumb?: BlobRef
}

export function isExternal<V>(v: V) {
  return is$typed(v, id, 'external')
}

export function validateExternal(v: unknown) {
  return lexicons.validate(`${id}#external`, v) as ValidationResult<External>
}

export function isValidExternal<V>(v: V): v is V & $Typed<External> {
  return isExternal(v) && validateExternal(v).success
}

export interface View {
  $type?: $Type<'app.bsky.embed.external', 'view'>
  external: ViewExternal
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

export interface ViewExternal {
  $type?: $Type<'app.bsky.embed.external', 'viewExternal'>
  uri: string
  title: string
  description: string
  thumb?: string
}

export function isViewExternal<V>(v: V) {
  return is$typed(v, id, 'viewExternal')
}

export function validateViewExternal(v: unknown) {
  return lexicons.validate(
    `${id}#viewExternal`,
    v,
  ) as ValidationResult<ViewExternal>
}

export function isValidViewExternal<V>(v: V): v is V & $Typed<ViewExternal> {
  return isViewExternal(v) && validateViewExternal(v).success
}
