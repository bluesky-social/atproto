/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { Headers, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../util'
import { lexicons } from '../../../lexicons'
import { CID } from 'multiformats/cid'
import * as ToolsOzoneDefs from './defs'
import * as ComAtprotoAdminDefs from '../../com/atproto/admin/defs'
import * as ComAtprotoRepoStrongRef from '../../com/atproto/repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  event:
    | ToolsOzoneDefs.ModEventTakedown
    | ToolsOzoneDefs.ModEventAcknowledge
    | ToolsOzoneDefs.ModEventEscalate
    | ToolsOzoneDefs.ModEventComment
    | ToolsOzoneDefs.ModEventLabel
    | ToolsOzoneDefs.ModEventReport
    | ToolsOzoneDefs.ModEventMute
    | ToolsOzoneDefs.ModEventReverseTakedown
    | ToolsOzoneDefs.ModEventUnmute
    | ToolsOzoneDefs.ModEventEmail
    | ToolsOzoneDefs.ModEventTag
    | { $type: string; [k: string]: unknown }
  subject:
    | ComAtprotoAdminDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ToolsOzoneDefs.ModEventView

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
