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
const id = 'tools.ozone.verification.grantVerifications'

export interface QueryParams {}

export interface InputSchema {
  /** Array of verification requests to process */
  verifications: VerificationInput[]
}

export interface OutputSchema {
  verifications: ToolsOzoneVerificationDefs.VerificationView[]
  failedVerifications: GrantError[]
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

export interface VerificationInput {
  $type?: 'tools.ozone.verification.grantVerifications#verificationInput'
  /** The did of the subject being verified */
  subject: string
  /** Handle of the subject the verification applies to at the moment of verifying. */
  handle: string
  /** Display name of the subject the verification applies to at the moment of verifying. */
  displayName: string
  /** Timestamp for verification record. Defaults to current time when not specified. */
  createdAt?: string
}

const hashVerificationInput = 'verificationInput'

export function isVerificationInput<V>(v: V) {
  return is$typed(v, id, hashVerificationInput)
}

export function validateVerificationInput<V>(v: V) {
  return validate<VerificationInput & V>(v, id, hashVerificationInput)
}

/** Error object for failed verifications. */
export interface GrantError {
  $type?: 'tools.ozone.verification.grantVerifications#grantError'
  /** Error message describing the reason for failure. */
  error: string
  /** The did of the subject being verified */
  subject: string
}

const hashGrantError = 'grantError'

export function isGrantError<V>(v: V) {
  return is$typed(v, id, hashGrantError)
}

export function validateGrantError<V>(v: V) {
  return validate<GrantError & V>(v, id, hashGrantError)
}
