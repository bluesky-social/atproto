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
const id = 'tools.ozone.report.claimReport'

export type QueryParams = {}

export interface InputSchema {
  /** The ID of the report to claim. */
  reportId: number
  /** Optional queue ID to associate the claim with. If not provided and the report has been claimed on a queue before, it will stay on that queue. */
  queueId?: number
  /** Whether to assign the report to the moderator. */
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

export class AlreadyClaimedError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'AlreadyClaimed') return new AlreadyClaimedError(e)
  }

  return e
}
