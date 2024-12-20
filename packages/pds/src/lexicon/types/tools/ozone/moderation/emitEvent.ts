/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import type * as ToolsOzoneModerationDefs from './defs'
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import type * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'tools.ozone.moderation.emitEvent'

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

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'SubjectHasAction'
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput
