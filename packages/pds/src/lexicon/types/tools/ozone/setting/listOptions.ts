/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import { $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import type * as ToolsOzoneSettingDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'tools.ozone.setting.listOptions'

export interface QueryParams {
  limit: number
  cursor?: string
  scope: 'instance' | 'personal' | (string & {})
  /** Filter keys by prefix */
  prefix?: string
  /** Filter for only the specified keys. Ignored if prefix is provided */
  keys?: string[]
}

export type InputSchema = undefined

export interface OutputSchema {
  cursor?: string
  options: ToolsOzoneSettingDefs.Option[]
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
