/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../actor/defs'
import * as AppBskyGraphDefs from './defs'

export interface QueryParams {
  actor: string
  includeUnaccepted?: boolean
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  vouches: ActorVouch[]
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

export interface ActorVouch {
  actor: AppBskyActorDefs.ProfileViewBasic
  vouch: AppBskyGraphDefs.VouchView
  [k: string]: unknown
}

export function isActorVouch(v: unknown): v is ActorVouch {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.graph.getVouchesGiven#actorVouch'
  )
}

export function validateActorVouch(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.graph.getVouchesGiven#actorVouch', v)
}
