/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as ComAtprotoRepoDefs from './defs'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo (aka, current account). */
  repo: string
  /** The NSID of the record collection. */
  collection: string
  /** The Record Key. */
  rkey: string
  /** Compare and swap with the previous record by CID. */
  swapRecord?: string
  /** Compare and swap with the previous commit by CID. */
  swapCommit?: string
  [k: string]: unknown
}

export interface OutputSchema {
  commit?: ComAtprotoRepoDefs.CommitMeta
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
  error?: 'InvalidSwap'
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
