/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, is$typed } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../actor/defs'

const id = 'app.bsky.graph.getSuggestedFollowsByActor'

export interface QueryParams {
  actor: string
}

export type InputSchema = undefined

export interface OutputSchema {
  suggestions: AppBskyActorDefs.ProfileView[]
  /** If true, response has fallen-back to generic results, and is not scoped using relativeToDid */
  isFallback: boolean
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
