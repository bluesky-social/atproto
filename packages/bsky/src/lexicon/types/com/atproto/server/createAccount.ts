/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.server.createAccount'

export interface QueryParams {}

export interface InputSchema {
  email?: string
  /** Requested handle for the account. */
  handle: string
  /** Pre-existing atproto DID, being imported to a new account. */
  did?: string
  inviteCode?: string
  verificationCode?: string
  verificationPhone?: string
  /** Initial account password. May need to meet instance-specific password strength requirements. */
  password?: string
  /** DID PLC rotation key (aka, recovery key) to be included in PLC creation operation. */
  recoveryKey?: string
  /** A signed DID PLC operation to be submitted as part of importing an existing account to this instance. NOTE: this optional field may be updated when full account migration is implemented. */
  plcOp?: { [_ in string]: unknown }
}

/** Account login session returned on successful account creation. */
export interface OutputSchema {
  accessJwt: string
  refreshJwt: string
  handle: string
  /** The DID of the new account. */
  did: string
  /** Complete DID document. */
  didDoc?: { [_ in string]: unknown }
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
  error?:
    | 'InvalidHandle'
    | 'InvalidPassword'
    | 'InvalidInviteCode'
    | 'HandleNotAvailable'
    | 'UnsupportedDomain'
    | 'UnresolvableDid'
    | 'IncompatibleDidDoc'
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
