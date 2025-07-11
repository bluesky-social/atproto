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
import type * as AppBskyUnspeccedDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.unspecced.initAgeAssurance'

export type QueryParams = {}

export interface InputSchema {
  /** The user's email address to receive assurance instructions. */
  email: string
  /** The user's preferred language for communication during the assurance process. */
  language: string
  /** An ISO 3166-1 alpha-2 code of the user's location. */
  countryCode: string
}

export type OutputSchema = AppBskyUnspeccedDefs.AgeAssuranceState

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export function toKnownErr(e: any) {
  return e
}
