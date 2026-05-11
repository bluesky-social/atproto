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
const id = 'tools.ozone.queue.routeReports'

export type QueryParams = {}

export interface InputSchema {
  /** Start of report ID range (inclusive). */
  startReportId: number
  /** End of report ID range (inclusive). Difference between start and end must be less than 5,000. */
  endReportId: number
}

export interface OutputSchema {
  /** The number of reports assigned to a queue. */
  assigned: number
  /** The number of reports with no matching queue. */
  unmatched: number
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

export class OutOfRangeError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'OutOfRange') return new OutOfRangeError(e)
  }

  return e
}
