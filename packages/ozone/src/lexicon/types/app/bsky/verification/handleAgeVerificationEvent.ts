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
const id = 'app.bsky.verification.handleAgeVerificationEvent'

export interface QueryParams {}

export interface InputSchema {
  /** The name of the event being reported, e.g., 'adult-verified'. */
  name?: string
  /** The timestamp of the event. Currently in ISO 8601 format, but left open for future flexibility. */
  time?: string
  /** The account identifier of our organization, in UUID format. */
  orgId?: string
  /** The product identifier, in UUID format. */
  productId?: string
  /** The environment identifier, in UUID format. */
  environmentId?: string
  payload?: Payload
}

export interface OutputSchema {
  /** Whether the event was handled or not. */
  ack: string
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

/** The payload of the event. */
export interface Payload {
  $type?: 'app.bsky.verification.handleAgeVerificationEvent#payload'
}

const hashPayload = 'payload'

export function isPayload<V>(v: V) {
  return is$typed(v, id, hashPayload)
}

export function validatePayload<V>(v: V) {
  return validate<Payload & V>(v, id, hashPayload)
}
