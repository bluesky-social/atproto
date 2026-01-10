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
const id = 'tools.ozone.moderation.cancelScheduledActions'

export type QueryParams = {}

export interface InputSchema {
  /** Array of DID subjects to cancel scheduled actions for */
  subjects: string[]
  /** Optional comment describing the reason for cancellation */
  comment?: string
}

export type OutputSchema = CancellationResults

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

export interface CancellationResults {
  $type?: 'tools.ozone.moderation.cancelScheduledActions#cancellationResults'
  /** DIDs for which all pending scheduled actions were successfully cancelled */
  succeeded: string[]
  /** DIDs for which cancellation failed with error details */
  failed: FailedCancellation[]
}

const hashCancellationResults = 'cancellationResults'

export function isCancellationResults<V>(v: V) {
  return is$typed(v, id, hashCancellationResults)
}

export function validateCancellationResults<V>(v: V) {
  return validate<CancellationResults & V>(v, id, hashCancellationResults)
}

export interface FailedCancellation {
  $type?: 'tools.ozone.moderation.cancelScheduledActions#failedCancellation'
  did: string
  error: string
  errorCode?: string
}

const hashFailedCancellation = 'failedCancellation'

export function isFailedCancellation<V>(v: V) {
  return is$typed(v, id, hashFailedCancellation)
}

export function validateFailedCancellation<V>(v: V) {
  return validate<FailedCancellation & V>(v, id, hashFailedCancellation)
}
