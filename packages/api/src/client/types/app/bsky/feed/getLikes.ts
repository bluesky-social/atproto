/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'

const id = 'app.bsky.feed.getLikes'

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
  [k: string]: unknown
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
  indexedAt: string
  createdAt: string
  actor: AppBskyActorDefs.ProfileView
  [k: string]: unknown
}

export function isLike(
  v: unknown,
): v is Like & { $type: $Type<'app.bsky.feed.getLikes', 'like'> } {
  return is$typed(v, id, 'like')
}

export function validateLike(v: unknown) {
  return lexicons.validate(`${id}#like`, v) as ValidationResult<Like>
}
