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
import type * as AppBskyContactDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.contact.getSyncStatus'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  syncStatus?: AppBskyContactDefs.SyncStatus
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

export class INVALID_DIDError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class INTERNAL_ERRORError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'INVALID_DID') return new INVALID_DIDError(e)
    if (e.error === 'INTERNAL_ERROR') return new INTERNAL_ERRORError(e)
  }

  return e
}
