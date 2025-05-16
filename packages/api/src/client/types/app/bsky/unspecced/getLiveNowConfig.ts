/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.unspecced.getLiveNowConfig'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  config: LiveNowUserConfig[]
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

export interface LiveNowUserConfig {
  $type?: 'app.bsky.unspecced.getLiveNowConfig#liveNowUserConfig'
  did: string
  domains: string[]
}

const hashLiveNowUserConfig = 'liveNowUserConfig'

export function isLiveNowUserConfig<V>(v: V) {
  return is$typed(v, id, hashLiveNowUserConfig)
}

export function validateLiveNowUserConfig<V>(v: V) {
  return validate<LiveNowUserConfig & V>(v, id, hashLiveNowUserConfig)
}
