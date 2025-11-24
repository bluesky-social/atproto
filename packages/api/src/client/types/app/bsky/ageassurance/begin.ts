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
import type * as AppBskyAgeassuranceDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.ageassurance.begin'

export type QueryParams = {}

export interface InputSchema {
  /** The user's email address to receive Age Assurance instructions. */
  email: string
  /** The user's preferred language for communication during the Age Assurance process. */
  language: string
  /** An ISO 3166-1 alpha-2 code of the user's location. */
  countryCode: string
  /** An optional ISO 3166-2 code of the user's region or state within the country. */
  regionCode?: string
}

export type OutputSchema = AppBskyAgeassuranceDefs.State

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

export class InvalidEmailError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class DidTooLongError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidInitiationError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class RegionNotSupportedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidEmail') return new InvalidEmailError(e)
    if (e.error === 'DidTooLong') return new DidTooLongError(e)
    if (e.error === 'InvalidInitiation') return new InvalidInitiationError(e)
    if (e.error === 'RegionNotSupported') return new RegionNotSupportedError(e)
  }

  return e
}
