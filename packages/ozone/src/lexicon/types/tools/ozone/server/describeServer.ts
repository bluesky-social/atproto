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

export type InputSchema = undefined

export interface OutputSchema {
  /** Users that have access to the service and their levels of access. */
  moderators: Moderator[]
  did: string
  /** The URL of the PLC server. */
  plcUrl?: string
  /** Configuration used to split subjects in multiple queues. */
  queueConfig?: {}
  [k: string]: unknown
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

export interface Moderator {
  did?: string
  handle?: string
  role?: 'admin' | 'moderator' | 'triage'
  [k: string]: unknown
}

export function isModerator(v: unknown): v is Moderator {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.server.describeServer#moderator'
  )
}

export function validateModerator(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.server.describeServer#moderator', v)
}
