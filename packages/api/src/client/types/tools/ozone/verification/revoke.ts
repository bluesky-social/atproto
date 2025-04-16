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
const id = 'tools.ozone.verification.revoke'

export interface QueryParams {}

export interface InputSchema {
  /** Array of verification record uris to revoke */
  uris: string[]
  /** Reason for revoking the verification. This is optional and can be omitted if not needed. */
  revokeReason?: string
}

export interface OutputSchema {
  /** List of verification uris successfully revoked */
  revokedVerifications: string[]
  /** List of verification uris that couldn't be revoked, including failure reasons */
  failedRevocations: string[]
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

export function toKnownErr(e: any) {
  return e
}
