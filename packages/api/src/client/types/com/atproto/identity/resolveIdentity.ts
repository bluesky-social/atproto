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
import type * as ComAtprotoIdentityDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.identity.resolveIdentity'

export type QueryParams = {
  /** Handle or DID to resolve. */
  identifier: string
}
export type InputSchema = undefined
export type OutputSchema = ComAtprotoIdentityDefs.IdentityInfo

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class HandleNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class DidNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class DidDeactivatedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'HandleNotFound') return new HandleNotFoundError(e)
    if (e.error === 'DidNotFound') return new DidNotFoundError(e)
    if (e.error === 'DidDeactivated') return new DidDeactivatedError(e)
  }

  return e
}
