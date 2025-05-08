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
const id = 'tools.ozone.verification.revokeVerifications'

export interface QueryParams {}

export interface InputSchema {
  /** Array of verification record uris to revoke */
  uris: string[]
  /** Reason for revoking the verification. This is optional and can be omitted if not needed. */
  revokeReason?: string
}

export interface OutputSchema {
  /** List of verification uris successfully revoked */
  revokedVerifications: string[]
  /** List of verification uris that couldn't be revoked, including failure reasons */
  failedRevocations: RevokeError[]
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
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

/** Error object for failed revocations */
export interface RevokeError {
  $type?: 'tools.ozone.verification.revokeVerifications#revokeError'
  /** The AT-URI of the verification record that failed to revoke. */
  uri: string
  /** Description of the error that occurred during revocation. */
  error: string
}

const hashRevokeError = 'revokeError'

export function isRevokeError<V>(v: V) {
  return is$typed(v, id, hashRevokeError)
}

export function validateRevokeError<V>(v: V) {
  return validate<RevokeError & V>(v, id, hashRevokeError)
}
