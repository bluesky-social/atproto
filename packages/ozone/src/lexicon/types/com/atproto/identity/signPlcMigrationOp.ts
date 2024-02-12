/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'

export interface QueryParams {}

export interface InputSchema {
  /** The new handle. */
  handle?: string
  /** The new signing key, formatted as a `did:key`. Normally provided by the service that the account is migrating to. */
  signingKey?: string
  /** An array of rotation keys, formatted as `did:key`s, ordered by highest to least authority. Normally provided by the service that the account is migrating to. */
  rotationKeys?: string[]
  /** The endpoint for the PDS that an account is migrating to. Note that this will be reflected in the DID doc as provided and therefore should include the protocol scheme (`https://`). */
  pdsEndpoint?: string
  [k: string]: unknown
}

export interface OutputSchema {
  /** A signed DID PLC operation. */
  plcOp: {}
  [k: string]: unknown
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
