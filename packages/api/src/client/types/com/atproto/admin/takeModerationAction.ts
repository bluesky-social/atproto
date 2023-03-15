/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ComAtprotoAdminDef from './def'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  action:
    | 'com.atproto.admin.def#takedown'
    | 'com.atproto.admin.def#flag'
    | 'com.atproto.admin.def#acknowledge'
    | (string & {})
  subject:
    | ComAtprotoAdminDef.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  reason: string
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminDef.ActionView

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

export class SubjectHasActionError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'SubjectHasAction') return new SubjectHasActionError(e)
  }
  return e
}
