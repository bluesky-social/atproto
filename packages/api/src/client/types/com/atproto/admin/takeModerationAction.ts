/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ComAtprotoAdminDefs from './defs'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  action:
    | 'com.atproto.admin.defs#takedown'
    | 'com.atproto.admin.defs#flag'
    | 'com.atproto.admin.defs#acknowledge'
    | (string & {})
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  createLabelVals?: string[]
  negateLabelVals?: string[]
  reason: string
  /** Indicates how long this action is meant to be in effect before automatically expiring. */
  durationInHours?: number
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminDefs.ActionView

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
    super(src.status, src.error, src.message, src.headers)
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'SubjectHasAction') return new SubjectHasActionError(e)
  }
  return e
}
