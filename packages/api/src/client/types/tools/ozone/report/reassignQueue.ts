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
import type * as ToolsOzoneModerationQueryReports from '../moderation/queryReports.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.report.reassignQueue'

export type QueryParams = {}

export interface InputSchema {
  /** ID of the report to reassign */
  reportId: number
  /** Target queue ID. Use -1 for 'unassigned'. */
  queueId: number
}

export interface OutputSchema {
  report: ToolsOzoneModerationQueryReports.ReportView
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
