/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ToolsOzoneModerationDefs from './defs'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  event:
    | ToolsOzoneModerationDefs.ModEventTakedown
    | ToolsOzoneModerationDefs.ModEventAcknowledge
    | ToolsOzoneModerationDefs.ModEventEscalate
    | ToolsOzoneModerationDefs.ModEventComment
    | ToolsOzoneModerationDefs.ModEventLabel
    | ToolsOzoneModerationDefs.ModEventReport
    | ToolsOzoneModerationDefs.ModEventMute
    | ToolsOzoneModerationDefs.ModEventReverseTakedown
    | ToolsOzoneModerationDefs.ModEventUnmute
    | ToolsOzoneModerationDefs.ModEventEmail
    | ToolsOzoneModerationDefs.ModEventTag
    | { $type: string; [k: string]: unknown }
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ToolsOzoneModerationDefs.ModEventView

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
