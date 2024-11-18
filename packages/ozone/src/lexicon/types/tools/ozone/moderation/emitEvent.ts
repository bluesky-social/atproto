/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
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
    | ToolsOzoneModerationDefs.ModEventUnmute
    | ToolsOzoneModerationDefs.ModEventMuteReporter
    | ToolsOzoneModerationDefs.ModEventUnmuteReporter
    | ToolsOzoneModerationDefs.ModEventReverseTakedown
    | ToolsOzoneModerationDefs.ModEventResolveAppeal
    | ToolsOzoneModerationDefs.ModEventEmail
    | ToolsOzoneModerationDefs.ModEventTag
    | ToolsOzoneModerationDefs.AccountEvent
    | ToolsOzoneModerationDefs.IdentityEvent
    | ToolsOzoneModerationDefs.RecordEvent
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
