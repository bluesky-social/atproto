/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth } from '@atproto/xrpc-server'
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

export type HandlerOutput = HandlerError | HandlerSuccess
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
