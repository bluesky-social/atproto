/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ToolsOzoneSetDefs from './defs'

export const id = 'tools.ozone.set.querySets'

export interface QueryParams {
  limit: number
  cursor?: string
  namePrefix?: string
  sortBy: 'name' | 'createdAt' | 'updatedAt'
  /** Defaults to ascending order of name field. */
  sortDirection: 'asc' | 'desc'
}

export type InputSchema = undefined

export interface OutputSchema {
  sets: ToolsOzoneSetDefs.SetView[]
  cursor?: string
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
