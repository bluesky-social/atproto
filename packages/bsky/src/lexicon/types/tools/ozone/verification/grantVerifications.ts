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
import type * as ToolsOzoneVerificationDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.verification.grantVerifications'

export interface QueryParams {}

export interface InputSchema {
  /** Array of verification requests to process */
  verifications: VerificationInput[]
}

export interface OutputSchema {
  verifications: ToolsOzoneVerificationDefs.VerificationView[]
  failedVerifications: GrantError[]
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

export interface VerificationInput {
  $type?: 'tools.ozone.verification.grantVerifications#verificationInput'
  /** The did of the subject being verified */
  subject: string
  /** Handle of the subject the verification applies to at the moment of verifying. */
  handle: string
  /** Display name of the subject the verification applies to at the moment of verifying. */
  displayName: string
  /** Timestamp for verification record. Defaults to current time when not specified. */
  createdAt?: string
}

const hashVerificationInput = 'verificationInput'

export function isVerificationInput<V>(v: V) {
  return is$typed(v, id, hashVerificationInput)
}

export function validateVerificationInput<V>(v: V) {
  return validate<VerificationInput & V>(v, id, hashVerificationInput)
}

/** Error object for failed verifications. */
export interface GrantError {
  $type?: 'tools.ozone.verification.grantVerifications#grantError'
  /** Error message describing the reason for failure. */
  error: string
  /** The did of the subject being verified */
  subject: string
}

const hashGrantError = 'grantError'

export function isGrantError<V>(v: V) {
  return is$typed(v, id, hashGrantError)
}

export function validateGrantError<V>(v: V) {
  return validate<GrantError & V>(v, id, hashGrantError)
}
