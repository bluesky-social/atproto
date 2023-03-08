/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { HandlerAuth } from '@atproto/xrpc-server'
import * as ComAtprotoReportReasonType from './reasonType'
import * as ComAtprotoRepoRepoRef from '../repo/repoRef'
import * as ComAtprotoRepoRecordRef from '../repo/recordRef'
import * as ComAtprotoRepoStrongRef from '../repo/strongRef'

export interface QueryParams {}

export interface InputSchema {
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoRecordRef.Main
    | { $type: string; [k: string]: unknown }
  [k: string]: unknown
}

export interface OutputSchema {
  id: number
  reasonType: ComAtprotoReportReasonType.Main
  reason?: string
  subject:
    | ComAtprotoRepoRepoRef.Main
    | ComAtprotoRepoStrongRef.Main
    | { $type: string; [k: string]: unknown }
  reportedByDid: string
  createdAt: string
  [k: string]: unknown
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type Handler<HA extends HandlerAuth = never> = (ctx: {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
}) => Promise<HandlerOutput> | HandlerOutput
