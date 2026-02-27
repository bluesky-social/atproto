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
const id = 'tools.ozone.report.assignModerator'

export type QueryParams = {}

export interface InputSchema {
  /** The ID of the report to assign. */
  reportId: number
  /** Optional queue ID to associate the assignment with. If not provided and the report has been assigned on a queue before, it will stay on that queue. */
  queueId?: number
  /** Whether to assign or un-assign the report to the user. */
  assign?: boolean
}

export type OutputSchema = ToolsOzoneReportDefs.AssignmentView

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

export class AlreadyAssignedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AlreadyAssigned') return new AlreadyAssignedError(e)
  }

  return e
}
