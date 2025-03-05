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
import type * as AppBskyVideoDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'app.bsky.video.uploadVideo'

export interface QueryParams {}

export type InputSchema = string | Uint8Array | Blob

export interface OutputSchema {
  jobStatus: AppBskyVideoDefs.JobStatus
}

export interface HandlerInput {
  encoding: 'video/mp4'
  body: stream.Readable
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
