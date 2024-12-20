/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.embed.external'

/** A representation of some externally linked content (eg, a URL and 'card'), embedded in a Bluesky record (eg, a post). */
export interface Main {
  $type?: $Type<'app.bsky.embed.external', 'main'>
  external: External
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain)
}

export function isValidMain<V>(v: V) {
  return isValid<Main>(v, id, hashMain)
}

export interface External {
  $type?: $Type<'app.bsky.embed.external', 'external'>
  uri: string
  title: string
  description: string
  thumb?: BlobRef
}

const hashExternal = 'external'

export function isExternal<V>(v: V) {
  return is$typed(v, id, hashExternal)
}

export function validateExternal<V>(v: V) {
  return validate<External & V>(v, id, hashExternal)
}

export function isValidExternal<V>(v: V) {
  return isValid<External>(v, id, hashExternal)
}

export interface View {
  $type?: $Type<'app.bsky.embed.external', 'view'>
  external: ViewExternal
}

const hashView = 'view'

export function isView<V>(v: V) {
  return is$typed(v, id, hashView)
}

export function validateView<V>(v: V) {
  return validate<View & V>(v, id, hashView)
}

export function isValidView<V>(v: V) {
  return isValid<View>(v, id, hashView)
}

export interface ViewExternal {
  $type?: $Type<'app.bsky.embed.external', 'viewExternal'>
  uri: string
  title: string
  description: string
  thumb?: string
}

const hashViewExternal = 'viewExternal'

export function isViewExternal<V>(v: V) {
  return is$typed(v, id, hashViewExternal)
}

export function validateViewExternal<V>(v: V) {
  return validate<ViewExternal & V>(v, id, hashViewExternal)
}

export function isValidViewExternal<V>(v: V) {
  return isValid<ViewExternal>(v, id, hashViewExternal)
}
