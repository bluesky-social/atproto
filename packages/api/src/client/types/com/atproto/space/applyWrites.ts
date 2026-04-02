/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { HeadersMap, XRPCError } from '@atproto/xrpc'
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.space.applyWrites'

export type QueryParams = {}

export interface InputSchema {
  /** Reference to the space. */
  space: string
  /** Can be set to 'false' to skip Lexicon schema validation of record data across all operations, 'true' to require it, or leave unset to validate only for known Lexicons. */
  validate?: boolean
  writes: ($Typed<Create> | $Typed<Update> | $Typed<Delete>)[]
  /** If provided, the entire operation will fail if the current commit CID does not match this value. */
  swapCommit?: string
}

export interface OutputSchema {
  results?: (
    | $Typed<CreateResult>
    | $Typed<UpdateResult>
    | $Typed<DeleteResult>
  )[]
}

export interface CallOptions {
  signal?: AbortSignal
  headers?: HeadersMap
  qp?: QueryParams
  encoding?: 'application/json'
}

export interface Response {
  success: boolean
  headers: HeadersMap
  data: OutputSchema
}

export class InvalidSwapError extends XRPCError {
  constructor(src: XRPCError) {
    super(src.status, src.error, src.message, src.headers, { cause: src })
  }
}

export function toKnownErr(e: any) {
  if (e instanceof XRPCError) {
    if (e.error === 'InvalidSwap') return new InvalidSwapError(e)
  }

  return e
}

/** Operation which creates a new record. */
export interface Create {
  $type?: 'com.atproto.space.applyWrites#create'
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

/** Operation which updates an existing record. */
export interface Update {
  $type?: 'com.atproto.space.applyWrites#update'
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
  $type?: 'com.atproto.space.applyWrites#delete'
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
  $type?: 'com.atproto.space.applyWrites#createResult'
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
  $type?: 'com.atproto.space.applyWrites#updateResult'
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
  $type?: 'com.atproto.space.applyWrites#deleteResult'
}

const hashDeleteResult = 'deleteResult'

export function isDeleteResult<V>(v: V) {
  return is$typed(v, id, hashDeleteResult)
}

export function validateDeleteResult<V>(v: V) {
  return validate<DeleteResult & V>(v, id, hashDeleteResult)
}
