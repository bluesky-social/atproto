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
  status?:
    | 'com.atproto.admin.defs#acknowledged'
    | 'com.atproto.admin.defs#muted'
    | 'com.atproto.admin.defs#escalated'
    | 'com.atproto.admin.defs#reported'
    | 'com.atproto.admin.defs#takendown'
    | (string & {})
  limit?: number
  cursor?: string
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  subjectStatuses: ComAtprotoAdminDefs.SubjectStatusView[]
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
