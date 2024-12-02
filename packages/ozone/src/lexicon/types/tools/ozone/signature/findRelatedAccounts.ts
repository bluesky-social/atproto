/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ComAtprotoAdminDefs from '../../../com/atproto/admin/defs'
import * as ToolsOzoneSignatureDefs from './defs'

export const id = 'tools.ozone.signature.findRelatedAccounts'

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
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

export interface RelatedAccount {
  $type?: $Type<'tools.ozone.signature.findRelatedAccounts', 'relatedAccount'>
  account: ComAtprotoAdminDefs.AccountView
  similarities?: ToolsOzoneSignatureDefs.SigDetail[]
}

export function isRelatedAccount<V>(v: V) {
  return is$typed(v, id, 'relatedAccount')
}

export function validateRelatedAccount(v: unknown) {
  return lexicons.validate(
    `${id}#relatedAccount`,
    v,
  ) as ValidationResult<RelatedAccount>
}

export function isValidRelatedAccount<V>(
  v: V,
): v is V & $Typed<RelatedAccount> {
  return isRelatedAccount(v) && validateRelatedAccount(v).success
}
