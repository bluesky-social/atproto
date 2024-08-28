/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ToolsOzoneHistoryDefs from './defs'
import * as ComAtprotoModerationDefs from '../../../com/atproto/moderation/defs'

export interface QueryParams {
  account?: string
  limit?: number
  sortDirection?: 'asc' | 'desc' | (string & {})
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  subjects: ReportView[]
  cursor?: string
  [k: string]: unknown
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

export interface ReportView {
  subject: ToolsOzoneHistoryDefs.SubjectBasicView
  report: Report
  [k: string]: unknown
}

export function isReportView(v: unknown): v is ReportView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.getReportedSubjects#reportView'
  )
}

export function validateReportView(v: unknown): ValidationResult {
  return lexicons.validate(
    'tools.ozone.history.getReportedSubjects#reportView',
    v,
  )
}

export interface Report {
  reasonType: ComAtprotoModerationDefs.ReasonType
  reason: string
  createdAt: string
  [k: string]: unknown
}

export function isReport(v: unknown): v is Report {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.history.getReportedSubjects#report'
  )
}

export function validateReport(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.history.getReportedSubjects#report', v)
}
