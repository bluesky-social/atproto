/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import { $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import type * as ComAtprotoRepoDefs from './defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.repo.applyWrites'

export interface QueryParams {}

export interface InputSchema {
  /** The handle or DID of the repo (aka, current account). */
  repo: string
  /** Can be set to 'false' to skip Lexicon schema validation of record data across all operations, 'true' to require it, or leave unset to validate only for known Lexicons. */
  validate?: boolean
  writes: ($Typed<Create> | $Typed<Update> | $Typed<Delete>)[]
  /** If provided, the entire operation will fail if the current repo commit CID does not match this value. Used to prevent conflicting repo mutations. */
  swapCommit?: string
}

export interface OutputSchema {
  commit?: ComAtprotoRepoDefs.CommitMeta
  results?: (
    | $Typed<CreateResult>
    | $Typed<UpdateResult>
    | $Typed<DeleteResult>
  )[]
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
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput

/** Operation which creates a new record. */
export interface Create {
  $type?: 'com.atproto.repo.applyWrites#create'
  collection: string
  /** NOTE: maxLength is redundant with record-key format. Keeping it temporarily to ensure backwards compatibility. */
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

/** Operation which updates an existing record. */
export interface Update {
  $type?: 'com.atproto.repo.applyWrites#update'
  collection: string
  rkey: string
  value: { [_ in string]: unknown }
}

const hashUpdate = 'update'

export function isUpdate<V>(v: V) {
  return is$typed(v, id, hashUpdate)
}

export function validateUpdate<V>(v: V) {
  return validate<Update & V>(v, id, hashUpdate)
}

/** Operation which deletes an existing record. */
export interface Delete {
  $type?: 'com.atproto.repo.applyWrites#delete'
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
  $type?: 'com.atproto.repo.applyWrites#createResult'
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
}

const hashCreateResult = 'createResult'

export function isCreateResult<V>(v: V) {
  return is$typed(v, id, hashCreateResult)
}

export function validateCreateResult<V>(v: V) {
  return validate<CreateResult & V>(v, id, hashCreateResult)
}

export interface UpdateResult {
  $type?: 'com.atproto.repo.applyWrites#updateResult'
  uri: string
  cid: string
  validationStatus?: 'valid' | 'unknown' | (string & {})
}

const hashUpdateResult = 'updateResult'

export function isUpdateResult<V>(v: V) {
  return is$typed(v, id, hashUpdateResult)
}

export function validateUpdateResult<V>(v: V) {
  return validate<UpdateResult & V>(v, id, hashUpdateResult)
}

export interface DeleteResult {
  $type?: 'com.atproto.repo.applyWrites#deleteResult'
}

const hashDeleteResult = 'deleteResult'

export function isDeleteResult<V>(v: V) {
  return is$typed(v, id, hashDeleteResult)
}

export function validateDeleteResult<V>(v: V) {
  return validate<DeleteResult & V>(v, id, hashDeleteResult)
}
