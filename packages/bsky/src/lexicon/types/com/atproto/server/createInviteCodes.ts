/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export const id = 'com.atproto.server.createInviteCodes'

export interface QueryParams {}

export interface InputSchema {
  codeCount: number
  useCount: number
  forAccounts?: string[]
}

export interface OutputSchema {
  codes: AccountCodes[]
}

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

export interface AccountCodes {
  $type?: $Type<'com.atproto.server.createInviteCodes', 'accountCodes'>
  account: string
  codes: string[]
}

export function isAccountCodes<V>(v: V) {
  return is$typed(v, id, 'accountCodes')
}

export function validateAccountCodes(v: unknown) {
  return lexicons.validate(
    `${id}#accountCodes`,
    v,
  ) as ValidationResult<AccountCodes>
}

export function isValidAccountCodes<V>(v: V): v is V & $Typed<AccountCodes> {
  return isAccountCodes(v) && validateAccountCodes(v).success
}
