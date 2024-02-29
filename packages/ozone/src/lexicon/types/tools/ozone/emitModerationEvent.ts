/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../lexicons'
import { isObj, hasProp } from '../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ToolsOzoneDefs from './defs'
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
    | ToolsOzoneDefs.RepoRef
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  subjectBlobCids?: string[]
  createdBy: string
  [k: string]: unknown
}

export type OutputSchema = ToolsOzoneDefs.ModEventView

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
