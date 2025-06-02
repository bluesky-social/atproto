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
const id = 'app.bsky.unspecced.applyPrivateWrite'

export interface QueryParams {}

export interface InputSchema {
  write: $Typed<Create> | $Typed<Delete>
}

export interface OutputSchema {
  result?: $Typed<CreateResult> | $Typed<DeleteResult>
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

/** Operation which creates a new record. */
export interface Create {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#create'
  collection: string
  rkey?: string
  value: { [_ in string]: unknown }
}

const hashCreate = 'create'

export function isCreate<V>(v: V) {
  return is$typed(v, id, hashCreate)
}

export function validateCreate<V>(v: V) {
  return validate<Create & V>(v, id, hashCreate)
}

/** Operation which creates a new record. */
export interface Delete {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#delete'
  collection: string
  rkey: string
}

const hashDelete = 'delete'

export function isDelete<V>(v: V) {
  return is$typed(v, id, hashDelete)
}

export function validateDelete<V>(v: V) {
  return validate<Delete & V>(v, id, hashDelete)
}

export interface CreateResult {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#createResult'
  rkey: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
}

const hashCreateResult = 'createResult'

export function isCreateResult<V>(v: V) {
  return is$typed(v, id, hashCreateResult)
}

export function validateCreateResult<V>(v: V) {
  return validate<CreateResult & V>(v, id, hashCreateResult)
}

export interface DeleteResult {
  $type?: 'app.bsky.unspecced.applyPrivateWrite#deleteResult'
  rkey: string
}

const hashDeleteResult = 'deleteResult'

export function isDeleteResult<V>(v: V) {
  return is$typed(v, id, hashDeleteResult)
}

export function validateDeleteResult<V>(v: V) {
  return validate<DeleteResult & V>(v, id, hashDeleteResult)
}
