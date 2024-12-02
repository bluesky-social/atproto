/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as ToolsOzoneModerationDefs from './defs'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export const id = 'tools.ozone.moderation.emitEvent'

export interface QueryParams {}

export interface InputSchema {
  event:
    | $Typed<ToolsOzoneModerationDefs.ModEventTakedown>
    | $Typed<ToolsOzoneModerationDefs.ModEventAcknowledge>
    | $Typed<ToolsOzoneModerationDefs.ModEventEscalate>
    | $Typed<ToolsOzoneModerationDefs.ModEventComment>
    | $Typed<ToolsOzoneModerationDefs.ModEventLabel>
    | $Typed<ToolsOzoneModerationDefs.ModEventReport>
    | $Typed<ToolsOzoneModerationDefs.ModEventMute>
    | $Typed<ToolsOzoneModerationDefs.ModEventUnmute>
    | $Typed<ToolsOzoneModerationDefs.ModEventMuteReporter>
    | $Typed<ToolsOzoneModerationDefs.ModEventUnmuteReporter>
    | $Typed<ToolsOzoneModerationDefs.ModEventReverseTakedown>
    | $Typed<ToolsOzoneModerationDefs.ModEventResolveAppeal>
    | $Typed<ToolsOzoneModerationDefs.ModEventEmail>
    | $Typed<ToolsOzoneModerationDefs.ModEventTag>
    | $Typed<ToolsOzoneModerationDefs.AccountEvent>
    | $Typed<ToolsOzoneModerationDefs.IdentityEvent>
    | $Typed<ToolsOzoneModerationDefs.RecordEvent>
    | { $type: string }
  subject:
    | $Typed<ComAtprotoAdminDefs.RepoRef>
    | $Typed<ComAtprotoRepoStrongRef.Main>
    | { $type: string }
  subjectBlobCids?: string[]
  createdBy: string
}

export type OutputSchema = ToolsOzoneModerationDefs.ModEventView

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class SubjectHasActionError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'SubjectHasAction') return new SubjectHasActionError(e)
  }

  return e
}
