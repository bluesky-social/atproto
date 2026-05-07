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
import type * as ToolsOzoneReportDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.reassignQueue'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the report to reassign */
  reportId: number
  /** Target queue ID. Use -1 to unassign from any queue. */
  queueId: number
  /** Optional moderator-only note recorded on the resulting queueActivity as internalNote. */
  comment?: string
}

export interface OutputSchema {
  report: ToolsOzoneReportDefs.ReportView
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

export class ReportNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class ReportClosedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class AlreadyInTargetQueueError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class QueueNotFoundError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class QueueDisabledError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'ReportNotFound') return new ReportNotFoundError(e)
    if (e.error === 'ReportClosed') return new ReportClosedError(e)
    if (e.error === 'AlreadyInTargetQueue')
      return new AlreadyInTargetQueueError(e)
    if (e.error === 'QueueNotFound') return new QueueNotFoundError(e)
    if (e.error === 'QueueDisabled') return new QueueDisabledError(e)
  }

  return e
}
