/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './defs'

export interface QueryParams {
  subject?: string
  ignoreSubjects?: string[]
  /** Get all reports that were actioned by a specific moderator */
  actionedBy?: string
  /** Filter reports made by one or more DIDs */
  reporters?: string[]
  resolved?: boolean
  actionType?:
    | 'com.atproto.admin.defs#takedown'
    | 'com.atproto.admin.defs#flag'
    | 'com.atproto.admin.defs#acknowledge'
    | 'com.atproto.admin.defs#escalate'
    | (string & {})
  limit?: number
  cursor?: string
  /** Reverse the order of the returned records? when true, returns reports in chronological order */
  reverse?: boolean
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  reports: ComAtprotoAdminDefs.ReportView[]
  [k: string]: unknown
}

export interface CallOptions {
  headers?: Headers
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
