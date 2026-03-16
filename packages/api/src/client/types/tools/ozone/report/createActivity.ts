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
const id = 'tools.ozone.report.createActivity'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the report to record activity on */
  reportId: number
  /** Type of activity to record */
  action: 'status_change' | 'note' | (string & {})
  /** Target status. Required when action is status_change. */
  toState?:
    | 'open'
    | 'closed'
    | 'escalated'
    | 'queued'
    | 'assigned'
    | (string & {})
  /** Optional free-text note. Can accompany any action type. */
  note?: string
  /** When action is status_change, also update report.status to toState. Defaults to true. */
  updateStatus?: boolean
}

export interface OutputSchema {
  activity: ToolsOzoneReportDefs.ReportActivityView
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

export class MissingTargetStateError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class InvalidStateTransitionError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export class AlreadyInTargetStateError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'ReportNotFound') return new ReportNotFoundError(e)
    if (e.error === 'MissingTargetState') return new MissingTargetStateError(e)
    if (e.error === 'InvalidStateTransition')
      return new InvalidStateTransitionError(e)
    if (e.error === 'AlreadyInTargetState')
      return new AlreadyInTargetStateError(e)
  }

  return e
}
