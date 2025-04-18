/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import stream from 'node:stream'
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
const id = 'com.atproto.sync.getBlob'

export interface QueryParams {
  /** The DID of the account. */
  did: string
  /** The CID of the blob to fetch */
  cid: string
}

export type InputSchema = undefined
export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: '*/*'
  body: Uint8Array | stream.Readable
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?:
    | 'BlobNotFound'
    | 'RepoNotFound'
    | 'RepoTakendown'
    | 'RepoSuspended'
    | 'RepoDeactivated'
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
