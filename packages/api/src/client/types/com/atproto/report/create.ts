/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import * as ComAtprotoReportReasonType from './reasonType'
import * as ComAtprotoReportSubject from './subject'

export interface QueryParams {}

export interface InputSchema {
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoReportSubject.Repo
    | ComAtprotoReportSubject.Record
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface OutputSchema {
  id: number
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoReportSubject.Repo
    | ComAtprotoReportSubject.RecordRef
    | { $type: string; [k: string]: unknown }
  reportedByDid: string
  createdAt: string
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
  qp?: QueryParams
  encoding: 'application/json'
}

export interface Response {
  success: boolean
  headers: Headers
  data: OutputSchema
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
  }
  return e
}
