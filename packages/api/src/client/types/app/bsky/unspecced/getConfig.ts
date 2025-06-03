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
const id = 'app.bsky.unspecced.getConfig'

export interface QueryParams {}

export type InputSchema = undefined

export interface OutputSchema {
  checkEmailConfirmed?: boolean
  liveNow?: LiveNowConfig[]
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

export interface LiveNowConfig {
  $type?: 'app.bsky.unspecced.getConfig#liveNowConfig'
  did: string
  domains: string[]
}

const hashLiveNowConfig = 'liveNowConfig'

export function isLiveNowConfig<V>(v: V) {
  return is$typed(v, id, hashLiveNowConfig)
}

export function validateLiveNowConfig<V>(v: V) {
  return validate<LiveNowConfig & V>(v, id, hashLiveNowConfig)
}
