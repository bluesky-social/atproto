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
import type * as ToolsOzoneVerificationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.verification.listVerifications'

export interface QueryParams {
  /** Pagination cursor */
  cursor?: string
  /** Maximum number of results to return */
  limit?: number
  /** Filter to verifications created after this timestamp */
  createdAfter?: string
  /** Filter to verifications created before this timestamp */
  createdBefore?: string
  /** Filter to verifications from specific issuers */
  issuers?: string[]
  /** Filter to specific verified DIDs */
  subjects?: string[]
  /** Sort direction for creation date */
  sortDirection?: 'asc' | 'desc'
  /** Filter to verifications that are revoked or not. By default, includes both. */
  isRevoked?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  verifications: ToolsOzoneVerificationDefs.VerificationView[]
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
