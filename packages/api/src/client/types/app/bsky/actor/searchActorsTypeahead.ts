/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from './defs'

export const id = 'app.bsky.actor.searchActorsTypeahead'

export interface QueryParams {
  /** DEPRECATED: use 'q' instead. */
  term?: string
  /** Search query prefix; not a full query string. */
  q?: string
  limit?: number
}

export type InputSchema = undefined

export interface OutputSchema {
  actors: AppBskyActorDefs.ProfileViewBasic[]
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
