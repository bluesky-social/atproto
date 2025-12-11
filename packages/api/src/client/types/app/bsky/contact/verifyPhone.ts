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
const id = 'app.bsky.contact.verifyPhone'

export type QueryParams = {}

export interface InputSchema {
  /** The phone number to verify. Should be the same as the one passed to `app.bsky.contact.startPhoneVerification`. */
  phone: string
  /** The code received via SMS as a result of the call to `app.bsky.contact.startPhoneVerification`. */
  code: string
}

export interface OutputSchema {
  /** JWT to be used in a call to `app.bsky.contact.importContacts`. It is only valid for a single call. */
  token: string
}

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

export class RateLimitExceededError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidDidError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidPhoneError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidCodeError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InternalError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'RateLimitExceeded') return new RateLimitExceededError(e)
    if (e.error === 'InvalidDid') return new InvalidDidError(e)
    if (e.error === 'InvalidPhone') return new InvalidPhoneError(e)
    if (e.error === 'InvalidCode') return new InvalidCodeError(e)
    if (e.error === 'InternalError') return new InternalError(e)
  }

  return e
}
