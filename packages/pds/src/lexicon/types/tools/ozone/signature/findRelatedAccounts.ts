/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import { $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import type * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs.js'
import type * as ToolsOzoneSignatureDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.signature.findRelatedAccounts'

export interface QueryParams {
  did: string
  cursor?: string
  limit: number
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  accounts: RelatedAccount[]
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface RelatedAccount {
  $type?: 'tools.ozone.signature.findRelatedAccounts#relatedAccount'
  account: ComAtprotoAdminDefs.AccountView
  similarities?: ToolsOzoneSignatureDefs.SigDetail[]
}

const hashRelatedAccount = 'relatedAccount'

export function isRelatedAccount<V>(v: V) {
  return is$typed(v, id, hashRelatedAccount)
}

export function validateRelatedAccount<V>(v: V) {
  return validate<RelatedAccount & V>(v, id, hashRelatedAccount)
}
