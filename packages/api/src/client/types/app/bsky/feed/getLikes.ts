/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'

export const id = 'app.bsky.feed.getLikes'

export interface QueryParams {
  /** AT-URI of the subject (eg, a post record). */
  uri: string
  /** CID of the subject record (aka, specific version of record), to filter likes. */
  cid?: string
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  uri: string
  cid?: string
  cursor?: string
  likes: Like[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}

export interface Like {
  $type?: $Type<'app.bsky.feed.getLikes', 'like'>
  indexedAt: string
  createdAt: string
  actor: AppBskyActorDefs.ProfileView
}

export function isLike<V>(v: V) {
  return is$typed(v, id, 'like')
}

export function validateLike(v: unknown) {
  return lexicons.validate(`${id}#like`, v) as ValidationResult<Like>
}

export function isValidLike<V>(v: V): v is V & $Typed<Like> {
  return isLike(v) && validateLike(v).success
}
