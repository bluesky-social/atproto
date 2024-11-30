/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoServerDefs from './defs'

export interface QueryParams {
  includeUsed?: boolean
  /** Controls whether any new 'earned' but not 'created' invites should be created. */
  createAvailable?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  codes: ComAtprotoServerDefs.InviteCode[]
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

export class DuplicateCreateError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'DuplicateCreate') return new DuplicateCreateError(e)
  }

  return e
}
