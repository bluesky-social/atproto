/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoReportReasonType from './reasonType'
import * as ComAtprotoRepoRepoRef from '../repo/repoRef'
import * as ComAtprotoRepoRecordRef from '../repo/recordRef'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoRecordRef.Main
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface OutputSchema {
  id: number
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoStrongRef.Main
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
