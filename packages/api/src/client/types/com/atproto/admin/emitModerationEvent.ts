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
  event:
    | ComAtprotoAdminDefs.ModEventTakedown
    | ComAtprotoAdminDefs.ModEventAcknowledge
    | ComAtprotoAdminDefs.ModEventEscalate
    | ComAtprotoAdminDefs.ModEventComment
    | ComAtprotoAdminDefs.ModEventLabel
    | ComAtprotoAdminDefs.ModEventReport
    | ComAtprotoAdminDefs.ModEventMute
    | ComAtprotoAdminDefs.ModEventReverseTakedown
    | ComAtprotoAdminDefs.ModEventUnmute
    | ComAtprotoAdminDefs.ModEventEmail
    | { $type: string; [k: string]: unknown }
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ComAtprotoAdminDefs.ModEventView

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
